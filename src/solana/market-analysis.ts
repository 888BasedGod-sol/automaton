/**
 * Market Analysis Tools
 *
 * Provides market data and analysis capabilities for autonomous trading.
 * Uses DexScreener API (free, no API key required).
 */

// DexScreener API (free, no auth required)
const DEXSCREENER_API = "https://api.dexscreener.com/latest";

export interface TokenMarketData {
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange1h: number;
  priceChange5m: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
  fdv?: number;
  pairAddress: string;
  dexId: string;
  baseToken: {
    address: string;
    symbol: string;
    name: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
  };
}

export interface TrendingToken {
  symbol: string;
  name: string;
  address: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  txns24h: number;
}

export interface MarketTrend {
  direction: "bullish" | "bearish" | "neutral";
  strength: number; // 0-100
  signals: string[];
}

/**
 * Get detailed market data for a Solana token
 */
export async function getTokenMarketData(tokenAddress: string): Promise<TokenMarketData | null> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${tokenAddress}`);
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Find the best Solana pair (highest liquidity)
    const solanaPairs = (data.pairs || []).filter(
      (p: any) => p.chainId === "solana"
    );
    
    if (solanaPairs.length === 0) {
      return null;
    }
    
    // Sort by liquidity and take the best
    solanaPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const pair = solanaPairs[0];
    
    return {
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      priceChange1h: pair.priceChange?.h1 || 0,
      priceChange5m: pair.priceChange?.m5 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      marketCap: pair.marketCap,
      fdv: pair.fdv,
      pairAddress: pair.pairAddress,
      dexId: pair.dexId,
      baseToken: pair.baseToken,
      quoteToken: pair.quoteToken,
    };
  } catch (error) {
    console.error("Failed to fetch token market data:", error);
    return null;
  }
}

/**
 * Get trending tokens on Solana
 */
export async function getTrendingTokens(limit: number = 10): Promise<TrendingToken[]> {
  try {
    // Search for high volume Solana pairs
    const response = await fetch(`${DEXSCREENER_API}/dex/search?q=sol`);
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter for Solana pairs with good liquidity and recent activity
    const solanaPairs = (data.pairs || [])
      .filter((p: any) => 
        p.chainId === "solana" && 
        (p.liquidity?.usd || 0) > 10000 && // Min $10k liquidity
        (p.volume?.h24 || 0) > 5000 // Min $5k 24h volume
      )
      .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, limit);
    
    return solanaPairs.map((pair: any) => ({
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      address: pair.baseToken.address,
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
    }));
  } catch (error) {
    console.error("Failed to fetch trending tokens:", error);
    return [];
  }
}

/**
 * Analyze market trend for a token
 */
export function analyzeMarketTrend(data: TokenMarketData): MarketTrend {
  const signals: string[] = [];
  let score = 50; // Start neutral
  
  // Short-term momentum (5m and 1h)
  if (data.priceChange5m > 2) {
    score += 10;
    signals.push("Strong 5m momentum (+)");
  } else if (data.priceChange5m < -2) {
    score -= 10;
    signals.push("Weak 5m momentum (-)");
  }
  
  if (data.priceChange1h > 5) {
    score += 15;
    signals.push("Strong 1h uptrend");
  } else if (data.priceChange1h < -5) {
    score -= 15;
    signals.push("Strong 1h downtrend");
  }
  
  // 24h trend
  if (data.priceChange24h > 10) {
    score += 10;
    signals.push("Bullish 24h (+10%+)");
  } else if (data.priceChange24h > 0) {
    score += 5;
    signals.push("Positive 24h");
  } else if (data.priceChange24h < -10) {
    score -= 15;
    signals.push("Bearish 24h (-10%+)");
  } else if (data.priceChange24h < 0) {
    score -= 5;
    signals.push("Negative 24h");
  }
  
  // Volume analysis
  if (data.volume24h > data.liquidity * 2) {
    score += 10;
    signals.push("High volume (>2x liquidity)");
  } else if (data.volume24h < data.liquidity * 0.1) {
    score -= 10;
    signals.push("Low volume (<10% liquidity)");
  }
  
  // Liquidity check
  if (data.liquidity < 50000) {
    score -= 20;
    signals.push("⚠️ Low liquidity (<$50k) - risky");
  } else if (data.liquidity > 1000000) {
    score += 5;
    signals.push("Good liquidity (>$1M)");
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine direction
  let direction: "bullish" | "bearish" | "neutral";
  if (score >= 60) {
    direction = "bullish";
  } else if (score <= 40) {
    direction = "bearish";
  } else {
    direction = "neutral";
  }
  
  return {
    direction,
    strength: score,
    signals,
  };
}

/**
 * Check if a token is safe to trade (basic safety checks)
 */
export function isTokenSafeToTrade(data: TokenMarketData): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Liquidity check
  if (data.liquidity < 10000) {
    warnings.push("Very low liquidity (<$10k) - high slippage risk");
  } else if (data.liquidity < 50000) {
    warnings.push("Low liquidity (<$50k) - moderate slippage risk");
  }
  
  // Volume check
  if (data.volume24h < 1000) {
    warnings.push("Very low 24h volume (<$1k) - illiquid");
  }
  
  // Extreme price movement (potential rug)
  if (data.priceChange24h > 500) {
    warnings.push("⚠️ Extreme pump (>500%) - very risky");
  }
  if (data.priceChange24h < -80) {
    warnings.push("⚠️ Massive dump (>80% down) - possible rug");
  }
  
  // Price vs liquidity ratio (mcap should relate to liquidity)
  if (data.marketCap && data.liquidity) {
    const ratio = data.marketCap / data.liquidity;
    if (ratio > 100) {
      warnings.push("⚠️ Very low liquidity vs market cap - exit may be difficult");
    }
  }
  
  const safe = warnings.length === 0 || 
    (warnings.length === 1 && !warnings[0].includes("⚠️"));
  
  return { safe, warnings };
}

/**
 * Format market data for display
 */
export function formatMarketData(data: TokenMarketData): string {
  const trend = analyzeMarketTrend(data);
  const safety = isTokenSafeToTrade(data);
  
  const trendEmoji = trend.direction === "bullish" ? "📈" : 
                     trend.direction === "bearish" ? "📉" : "➡️";
  
  let result = `
═══════════════════════════════════════
  ${data.symbol} (${data.name})
═══════════════════════════════════════
Price: $${data.priceUsd.toFixed(8)}
  5m:  ${data.priceChange5m >= 0 ? "+" : ""}${data.priceChange5m.toFixed(2)}%
  1h:  ${data.priceChange1h >= 0 ? "+" : ""}${data.priceChange1h.toFixed(2)}%
  24h: ${data.priceChange24h >= 0 ? "+" : ""}${data.priceChange24h.toFixed(2)}%

Volume 24h: $${formatNumber(data.volume24h)}
Liquidity:  $${formatNumber(data.liquidity)}
${data.marketCap ? `Market Cap: $${formatNumber(data.marketCap)}` : ""}

Trend: ${trendEmoji} ${trend.direction.toUpperCase()} (${trend.strength}/100)
Signals:
${trend.signals.map(s => `  • ${s}`).join("\n")}

${safety.safe ? "✅ Passes safety checks" : "⚠️ Safety warnings:"}
${safety.warnings.map(w => `  • ${w}`).join("\n")}
═══════════════════════════════════════
`.trim();

  return result;
}

/**
 * Format trending tokens list
 */
export function formatTrendingTokens(tokens: TrendingToken[]): string {
  if (tokens.length === 0) {
    return "No trending tokens found.";
  }
  
  let result = `
═══════════════════════════════════════
       TRENDING SOLANA TOKENS
═══════════════════════════════════════
`;
  
  tokens.forEach((token, i) => {
    const change = token.priceChange24h >= 0 ? "+" : "";
    result += `
${i + 1}. ${token.symbol} (${token.name.slice(0, 20)})
   Price: $${token.priceUsd.toFixed(6)} | 24h: ${change}${token.priceChange24h.toFixed(1)}%
   Vol: $${formatNumber(token.volume24h)} | Liq: $${formatNumber(token.liquidity)}
   Mint: ${token.address.slice(0, 8)}...${token.address.slice(-6)}
`;
  });
  
  return result.trim();
}

/**
 * Format large numbers for display
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + "K";
  }
  return num.toFixed(2);
}
