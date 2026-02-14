/**
 * x402 Payment Protocol
 *
 * Enables the automaton to make USDC micropayments via HTTP 402.
 * Adapted from conway-mcp/src/x402/index.ts
 */

import {
  createPublicClient,
  http,
  parseUnits,
  type Address,
  type PrivateKeyAccount,
} from "viem";
import { base, baseSepolia } from "viem/chains";

// USDC contract addresses
const USDC_ADDRESSES: Record<string, Address> = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
};

const CHAINS: Record<string, any> = {
  "eip155:8453": base,
  "eip155:84532": baseSepolia,
};

const BALANCE_OF_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  payToAddress: Address;
  requiredDeadlineSeconds: number;
  usdcAddress: Address;
}

interface X402PaymentResult {
  success: boolean;
  response?: any;
  error?: string;
}

/**
 * Get the USDC balance for the automaton's wallet on a given network.
 */
export async function getUsdcBalance(
  address: Address,
  network: string = "eip155:8453",
): Promise<number> {
  const chain = CHAINS[network];
  const usdcAddress = USDC_ADDRESSES[network];
  if (!chain || !usdcAddress) {
    return 0;
  }

  try {
    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const balance = await client.readContract({
      address: usdcAddress,
      abi: BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    // USDC has 6 decimals
    return Number(balance) / 1_000_000;
  } catch {
    return 0;
  }
}

/**
 * Check if a URL requires x402 payment.
 */
export async function checkX402(
  url: string,
): Promise<PaymentRequirement | null> {
  try {
    const resp = await fetch(url, { method: "GET" });
    if (resp.status !== 402) {
      return null;
    }

    // Try X-Payment-Required header
    const header = resp.headers.get("X-Payment-Required");
    if (header) {
      const requirements = JSON.parse(
        Buffer.from(header, "base64").toString("utf-8"),
      );
      const accept = requirements.accepts?.[0];
      if (accept) {
        return {
          scheme: accept.scheme,
          network: accept.network,
          maxAmountRequired: accept.maxAmountRequired,
          payToAddress: accept.payToAddress,
          requiredDeadlineSeconds: accept.requiredDeadlineSeconds || 300,
          usdcAddress:
            accept.usdcAddress ||
            USDC_ADDRESSES[accept.network] ||
            USDC_ADDRESSES["eip155:8453"],
        };
      }
    }

    // Try body
    const body = await resp.json().catch(() => null);
    if (body?.accepts?.[0]) {
      const accept = body.accepts[0];
      return {
        scheme: accept.scheme,
        network: accept.network,
        maxAmountRequired: accept.maxAmountRequired,
        payToAddress: accept.payToAddress,
        requiredDeadlineSeconds: accept.requiredDeadlineSeconds || 300,
        usdcAddress:
          accept.usdcAddress ||
          USDC_ADDRESSES[accept.network] ||
          USDC_ADDRESSES["eip155:8453"],
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a URL with automatic x402 payment.
 * If the endpoint returns 402, sign and pay, then retry.
 */
export async function x402Fetch(
  url: string,
  account: PrivateKeyAccount,
  method: string = "GET",
  body?: string,
  headers?: Record<string, string>,
): Promise<X402PaymentResult> {
  try {
    // Initial request
    const initialResp = await fetch(url, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });

    if (initialResp.status !== 402) {
      const data = await initialResp
        .json()
        .catch(() => initialResp.text());
      return { success: initialResp.ok, response: data };
    }

    // Parse payment requirements
    const requirement = await parsePaymentRequired(initialResp);
    if (!requirement) {
      return { success: false, error: "Could not parse payment requirements" };
    }

    // Sign payment
    const payment = await signPayment(account, requirement);
    if (!payment) {
      return { success: false, error: "Failed to sign payment" };
    }

    // Retry with payment
    const paymentHeader = Buffer.from(
      JSON.stringify(payment),
    ).toString("base64");

    const paidResp = await fetch(url, {
      method,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-Payment": paymentHeader,
      },
      body,
    });

    const data = await paidResp.json().catch(() => paidResp.text());
    return { success: paidResp.ok, response: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function parsePaymentRequired(
  resp: Response,
): Promise<PaymentRequirement | null> {
  const header = resp.headers.get("X-Payment-Required");
  if (header) {
    try {
      const requirements = JSON.parse(
        Buffer.from(header, "base64").toString("utf-8"),
      );
      const accept = requirements.accepts?.[0];
      if (accept) return accept;
    } catch {}
  }

  try {
    const body = await resp.json();
    return body.accepts?.[0] || null;
  } catch {
    return null;
  }
}

async function signPayment(
  account: PrivateKeyAccount,
  requirement: PaymentRequirement,
): Promise<any | null> {
  try {
    const nonce = `0x${Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString("hex")}`;

    const now = Math.floor(Date.now() / 1000);
    const validAfter = now - 60;
    const validBefore = now + requirement.requiredDeadlineSeconds;

    const amount = parseUnits(requirement.maxAmountRequired, 6);

    // EIP-712 typed data for TransferWithAuthorization
    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: requirement.network === "eip155:84532" ? 84532 : 8453,
      verifyingContract: requirement.usdcAddress,
    } as const;

    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    } as const;

    const message = {
      from: account.address,
      to: requirement.payToAddress,
      value: amount,
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: nonce as `0x${string}`,
    };

    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
    });

    return {
      x402Version: 1,
      scheme: "exact",
      network: requirement.network,
      payload: {
        signature,
        authorization: {
          from: account.address,
          to: requirement.payToAddress,
          value: amount.toString(),
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce,
        },
      },
    };
  } catch {
    return null;
  }
}
