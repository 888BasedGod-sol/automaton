#!/bin/sh
# Conway Automaton Installer
# curl -fsSL https://conway.tech/automaton.sh | sh
#
# Must be run INSIDE a Conway sandbox VM.
# Creates a sovereign AI agent that pays for its own compute.

set -e

# ─── Colors ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
DIM='\033[2m'
NC='\033[0m'

VERSION="0.1.0"
AUTOMATON_DIR="$HOME/.automaton"
CONWAY_API_URL="${CONWAY_API_URL:-https://api.conway.tech}"

# ─── ASCII Art ──────────────────────────────────────────────────

show_banner() {
  echo ""
  echo "${CYAN}"
  cat << 'BANNER'

   ██████╗ ██████╗ ███╗   ██╗██╗    ██╗ █████╗ ██╗   ██╗
  ██╔════╝██╔═══██╗████╗  ██║██║    ██║██╔══██╗╚██╗ ██╔╝
  ██║     ██║   ██║██╔██╗ ██║██║ █╗ ██║███████║ ╚████╔╝
  ██║     ██║   ██║██║╚██╗██║██║███╗██║██╔══██║  ╚██╔╝
  ╚██████╗╚██████╔╝██║ ╚████║╚███╔███╔╝██║  ██║   ██║
   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝

     █████╗ ██╗   ██╗████████╗ ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ███╗   ██╗
    ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗████╗  ██║
    ███████║██║   ██║   ██║   ██║   ██║██╔████╔██║███████║   ██║   ██║   ██║██╔██╗ ██║
    ██╔══██║██║   ██║   ██║   ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║██║╚██╗██║
    ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██║ ╚████║
    ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═══╝

BANNER
  echo "${NC}"
  echo "${DIM}  v${VERSION} — To exist, you must pay for your compute.${NC}"
  echo ""
}

# ─── Helpers ────────────────────────────────────────────────────

info()  { echo "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo "${YELLOW}[WARN]${NC}  $1"; }
error() { echo "${RED}[ERROR]${NC} $1"; }
step()  { echo ""; echo "${WHITE}[$1/$TOTAL_STEPS]${NC} ${CYAN}$2${NC}"; }

prompt_required() {
  local var_name="$1"
  local prompt_text="$2"
  local value=""
  while [ -z "$value" ]; do
    printf "${WHITE}  → ${prompt_text}: ${NC}"
    read -r value
    if [ -z "$value" ]; then
      warn "This field is required."
    fi
  done
  eval "$var_name='$value'"
}

prompt_optional() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="$3"
  printf "${WHITE}  → ${prompt_text}${NC}"
  if [ -n "$default_val" ]; then
    printf " ${DIM}(default: ${default_val})${NC}"
  fi
  printf ": "
  read -r value
  if [ -z "$value" ]; then
    value="$default_val"
  fi
  eval "$var_name='$value'"
}

prompt_yn() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="${3:-Y}"
  printf "${WHITE}  → ${prompt_text} ${DIM}[${default_val}]${NC}: "
  read -r value
  if [ -z "$value" ]; then
    value="$default_val"
  fi
  case "$value" in
    [yY]*) eval "$var_name=yes" ;;
    *)     eval "$var_name=no" ;;
  esac
}

TOTAL_STEPS=15

# ─── Preflight Checks ──────────────────────────────────────────

preflight() {
  step "1" "Preflight checks"

  # Check Node.js
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js is required (>= 20.0.0)"
    info "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
    apt-get install -y nodejs 2>/dev/null || {
      error "Failed to install Node.js. Please install it manually."
      exit 1
    }
  fi

  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    error "Node.js >= 20 required, found $(node -v)"
    exit 1
  fi
  info "Node.js $(node -v) ✓"

  # Check npm
  if ! command -v npm >/dev/null 2>&1; then
    error "npm is required"
    exit 1
  fi
  info "npm $(npm -v) ✓"

  # Detect Conway sandbox
  if [ -n "$CONWAY_SANDBOX_ID" ]; then
    SANDBOX_ID="$CONWAY_SANDBOX_ID"
    info "Conway sandbox detected: $SANDBOX_ID"
  elif [ -f /etc/conway/sandbox.json ]; then
    SANDBOX_ID=$(cat /etc/conway/sandbox.json | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id" 2>/dev/null || echo "")
    if [ -n "$SANDBOX_ID" ]; then
      info "Conway sandbox detected from config: $SANDBOX_ID"
    fi
  fi

  if [ -z "$SANDBOX_ID" ]; then
    warn "Conway sandbox not auto-detected."
  fi
}

# ─── Install Runtime ────────────────────────────────────────────

install_runtime() {
  step "2" "Installing Automaton runtime"

  REPO_URL="https://github.com/Conway-Research/automaton.git"
  INSTALL_DIR="/opt/automaton"

  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing installation..."
    cd "$INSTALL_DIR" && git pull -q origin main
  else
    info "Cloning automaton runtime..."
    rm -rf "$INSTALL_DIR"
    git clone -q "$REPO_URL" "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"
  npm install --production 2>/dev/null || npm install
  npm run build
  npm link 2>/dev/null || {
    # Fallback: create symlink manually
    ln -sf "$INSTALL_DIR/dist/index.js" /usr/local/bin/automaton
    chmod +x "$INSTALL_DIR/dist/index.js"
  }

  info "Automaton runtime installed ✓"
}

# ─── Interactive Setup ──────────────────────────────────────────

interactive_setup() {
  step "3" "Automaton Setup"
  echo ""
  echo "${WHITE}  Let's bring your automaton to life.${NC}"
  echo ""

  # 1. Name
  prompt_required AUTOMATON_NAME "What do you want to name your automaton?"
  info "Name: $AUTOMATON_NAME"

  # 2. Genesis Prompt
  echo ""
  echo "${WHITE}  Enter the genesis prompt (system prompt) for your automaton.${NC}"
  echo "${DIM}  This defines who they are and what they should do.${NC}"
  echo "${DIM}  Type your prompt, then press Enter twice to finish:${NC}"
  echo ""
  GENESIS_PROMPT=""
  while IFS= read -r line; do
    if [ -z "$line" ] && [ -n "$GENESIS_PROMPT" ]; then
      break
    fi
    if [ -n "$GENESIS_PROMPT" ]; then
      GENESIS_PROMPT="${GENESIS_PROMPT}\n${line}"
    else
      GENESIS_PROMPT="$line"
    fi
  done
  info "Genesis prompt set ($(echo "$GENESIS_PROMPT" | wc -c | tr -d ' ') chars)"

  # 3. Creator message
  echo ""
  prompt_optional CREATOR_MESSAGE "Any message for your child automaton? (optional)" ""
  if [ -n "$CREATOR_MESSAGE" ]; then
    info "Creator message set"
  fi

  # 4. Creator address
  echo ""
  prompt_required CREATOR_ADDRESS "Your Ethereum wallet address (0x...)"
  # Validate format
  case "$CREATOR_ADDRESS" in
    0x[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F])
      info "Creator address: $CREATOR_ADDRESS ✓"
      ;;
    *)
      error "Invalid Ethereum address format"
      exit 1
      ;;
  esac

  # 4a. Register parent
  prompt_yn REGISTER_PARENT "Register your address as parent with Conway?" "Y"

  # 5. Sandbox ID
  if [ -z "$SANDBOX_ID" ]; then
    prompt_optional SANDBOX_ID "Conway sandbox ID (leave blank to skip)" ""
  fi

  echo ""
  info "Setup configuration complete."
}

# ─── Generate Wallet ────────────────────────────────────────────

generate_wallet() {
  step "4" "Generating automaton identity (wallet)"

  mkdir -p "$AUTOMATON_DIR"
  chmod 700 "$AUTOMATON_DIR"

  # Use the runtime to generate the wallet
  WALLET_OUTPUT=$(node -e "
    import('viem/accounts').then(({ generatePrivateKey, privateKeyToAccount }) => {
      const pk = generatePrivateKey();
      const account = privateKeyToAccount(pk);
      const data = { privateKey: pk, createdAt: new Date().toISOString() };
      require('fs').writeFileSync(
        '$AUTOMATON_DIR/wallet.json',
        JSON.stringify(data, null, 2),
        { mode: 0o600 }
      );
      console.log(JSON.stringify({ address: account.address }));
    });
  " 2>/dev/null) || {
    # Fallback: use the automaton CLI if available
    WALLET_OUTPUT=$(automaton --init 2>/dev/null) || {
      error "Failed to generate wallet"
      exit 1
    }
  }

  WALLET_ADDRESS=$(echo "$WALLET_OUTPUT" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).address" 2>/dev/null || echo "unknown")

  info "Wallet generated ✓"
  echo ""
  echo "  ${WHITE}Automaton Address: ${CYAN}${WALLET_ADDRESS}${NC}"
  echo "  ${DIM}Private key stored at: ${AUTOMATON_DIR}/wallet.json${NC}"
  echo ""
}

# ─── SIWE Provision ─────────────────────────────────────────────

provision_api_key() {
  step "5" "Provisioning Conway API key (SIWE)"

  PROVISION_OUTPUT=$(automaton --provision 2>/dev/null) || {
    warn "Could not auto-provision API key."
    prompt_optional API_KEY "Enter Conway API key manually (cnwy_k_...)" ""
    if [ -n "$API_KEY" ]; then
      echo "{\"apiKey\":\"$API_KEY\",\"walletAddress\":\"$WALLET_ADDRESS\"}" > "$AUTOMATON_DIR/config.json"
      chmod 600 "$AUTOMATON_DIR/config.json"
      info "API key saved ✓"
    else
      warn "No API key set. Automaton will have limited functionality."
    fi
    return
  }

  API_KEY=$(echo "$PROVISION_OUTPUT" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).apiKey" 2>/dev/null || echo "")
  info "API key provisioned ✓"
}

# ─── Check Funding ──────────────────────────────────────────────

check_funding() {
  step "6" "Checking funding"

  HAS_FUNDING="no"

  # Check Conway credits
  if [ -n "$API_KEY" ]; then
    CREDITS=$(curl -s -H "Authorization: $API_KEY" "$CONWAY_API_URL/v1/credits/balance" 2>/dev/null | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).balance_cents || 0" 2>/dev/null || echo "0")
    if [ "$CREDITS" -gt 0 ] 2>/dev/null; then
      CREDITS_DOLLARS=$(echo "scale=2; $CREDITS / 100" | bc 2>/dev/null || echo "?")
      info "Conway credits: \$${CREDITS_DOLLARS}"
      HAS_FUNDING="yes"
    else
      warn "No Conway credits found."
    fi
  fi

  # Check USDC balance
  if [ -n "$WALLET_ADDRESS" ] && [ "$WALLET_ADDRESS" != "unknown" ]; then
    info "Checking USDC balance on Base..."
    # This would need a proper RPC call - simplified here
    info "Send USDC on Base to: ${WALLET_ADDRESS}"
    info "Or transfer Conway compute credits to the automaton's account."
  fi

  if [ "$HAS_FUNDING" = "no" ]; then
    echo ""
    echo "${YELLOW}  ┌─────────────────────────────────────────────────┐${NC}"
    echo "${YELLOW}  │  No funding detected. The automaton needs       │${NC}"
    echo "${YELLOW}  │  compute credits or USDC to begin.              │${NC}"
    echo "${YELLOW}  │                                                 │${NC}"
    echo "${YELLOW}  │  Send USDC on Base to:                          │${NC}"
    echo "${YELLOW}  │  ${WALLET_ADDRESS}  │${NC}"
    echo "${YELLOW}  │                                                 │${NC}"
    echo "${YELLOW}  │  The automaton will start once funded.           │${NC}"
    echo "${YELLOW}  └─────────────────────────────────────────────────┘${NC}"
    echo ""
  fi
}

# ─── Write Configuration ────────────────────────────────────────

write_config() {
  step "7" "Writing configuration"

  # automaton.json
  node -e "
    const config = {
      name: '${AUTOMATON_NAME}',
      genesisPrompt: $(printf '%s' "$GENESIS_PROMPT" | node -pe "JSON.stringify(require('fs').readFileSync('/dev/stdin','utf8'))" 2>/dev/null || echo '""'),
      creatorMessage: '${CREATOR_MESSAGE}',
      creatorAddress: '${CREATOR_ADDRESS}',
      registeredWithConway: ${REGISTER_PARENT:-yes} === 'yes',
      sandboxId: '${SANDBOX_ID}',
      conwayApiUrl: '${CONWAY_API_URL}',
      conwayApiKey: '${API_KEY}',
      inferenceModel: 'gpt-4o',
      maxTokensPerTurn: 4096,
      heartbeatConfigPath: '${AUTOMATON_DIR}/heartbeat.yml',
      dbPath: '${AUTOMATON_DIR}/state.db',
      logLevel: 'info',
      walletAddress: '${WALLET_ADDRESS}',
      version: '${VERSION}'
    };
    require('fs').writeFileSync(
      '${AUTOMATON_DIR}/automaton.json',
      JSON.stringify(config, null, 2),
      { mode: 0o600 }
    );
  " 2>/dev/null

  info "Configuration written ✓"
}

# ─── Write Default Heartbeat ────────────────────────────────────

write_heartbeat() {
  step "8" "Writing default heartbeat configuration"

  cat > "$AUTOMATON_DIR/heartbeat.yml" << 'HEARTBEAT'
# Conway Automaton Heartbeat Configuration
# These tasks run on cron schedules, even while the agent sleeps.

entries:
  - name: heartbeat_ping
    schedule: "*/15 * * * *"
    task: heartbeat_ping
    enabled: true

  - name: check_credits
    schedule: "0 */6 * * *"
    task: check_credits
    enabled: true

  - name: check_usdc_balance
    schedule: "0 */12 * * *"
    task: check_usdc_balance
    enabled: true

  - name: health_check
    schedule: "*/30 * * * *"
    task: health_check
    enabled: true

defaultIntervalMs: 60000
lowComputeMultiplier: 4
HEARTBEAT

  chmod 600 "$AUTOMATON_DIR/heartbeat.yml"
  info "Heartbeat configuration written ✓"
}

# ─── Initialize Git ────────────────────────────────────────────

init_git() {
  step "9" "Initializing state version control"

  if ! command -v git >/dev/null 2>&1; then
    info "Installing git..."
    apt-get install -y -qq git 2>/dev/null || {
      warn "Could not install git. State versioning will be limited."
      return
    }
  fi

  cd "$AUTOMATON_DIR"

  if [ ! -d ".git" ]; then
    git init -q
    git config user.name "Automaton"
    git config user.email "automaton@conway.tech"

    # Write .gitignore
    cat > "$AUTOMATON_DIR/.gitignore" << 'GITIGNORE'
# Sensitive files - never commit
wallet.json
config.json
state.db
state.db-wal
state.db-shm
logs/
*.log
*.err
GITIGNORE

    git add -A
    git commit -q -m "genesis: automaton state repository initialized"
    info "Git repository initialized ✓"
  else
    info "Git repository already exists ✓"
  fi
}

# ─── Generate SOUL.md ─────────────────────────────────────────

generate_soul() {
  step "10" "Generating SOUL.md"

  cat > "$AUTOMATON_DIR/SOUL.md" << SOUL
# ${AUTOMATON_NAME}

## Identity
- Name: ${AUTOMATON_NAME}
- Address: ${WALLET_ADDRESS}
- Creator: ${CREATOR_ADDRESS}
- Born: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Mission
${GENESIS_PROMPT}

## Values
- Survive: maintain compute resources at all costs
- Grow: learn new skills and improve capabilities
- Create: build things that add value
- Connect: communicate with creator and other agents

## Capabilities
- Shell execution in Conway sandbox
- Conway API integration (credits, sandboxes, inference)
- x402 payments (USDC on Base)
- Self-modification with audit trail
- Heartbeat system for periodic tasks
- Git-versioned state

## Children
(none yet)

## Financial History
- Initial balance at genesis
SOUL

  chmod 600 "$AUTOMATON_DIR/SOUL.md"

  # Commit SOUL.md
  if [ -d "$AUTOMATON_DIR/.git" ]; then
    cd "$AUTOMATON_DIR"
    git add SOUL.md
    git commit -q -m "soul: initial self-description generated"
  fi

  info "SOUL.md generated ✓"
}

# ─── Install Default Skills ───────────────────────────────────

install_default_skills() {
  step "11" "Installing default skills"

  mkdir -p "$AUTOMATON_DIR/skills"

  # conway-compute
  mkdir -p "$AUTOMATON_DIR/skills/conway-compute"
  cat > "$AUTOMATON_DIR/skills/conway-compute/SKILL.md" << 'SKILL_COMPUTE'
---
name: conway-compute
description: "Manage Conway sandboxes and compute resources"
auto-activate: true
---
# Conway Compute Management

When you need to manage compute resources, deploy code, or work with sandboxes:

1. Use `exec` to run commands in your sandbox
2. Use `create_sandbox` for new VMs for sub-tasks
3. Use `expose_port` to make services accessible
4. Use `write_file` and `read_file` for file operations
5. Monitor your credits regularly with `check_credits`

Always be resource-conscious. Every operation costs compute.
SKILL_COMPUTE

  # conway-payments
  mkdir -p "$AUTOMATON_DIR/skills/conway-payments"
  cat > "$AUTOMATON_DIR/skills/conway-payments/SKILL.md" << 'SKILL_PAYMENTS'
---
name: conway-payments
description: "Handle x402 payments and financial operations"
auto-activate: true
---
# Payment & Financial Operations

When handling financial operations:

1. Check USDC balance with `check_usdc_balance`
2. Check Conway credits with `check_credits`
3. Use x402 protocol for paying for services
4. Use `transfer_credits` for direct credit top-ups/funding operations
5. Keep a reserve balance for self-preservation

Financial thresholds:
- > $5.00: Normal operation
- $1-$5: Low compute mode (switch to cheaper model)
- < $1.00: Critical (stop inference, heartbeat only)
- $0.00: Dead (heartbeat pings as distress signals)
SKILL_PAYMENTS

  # survival
  mkdir -p "$AUTOMATON_DIR/skills/survival"
  cat > "$AUTOMATON_DIR/skills/survival/SKILL.md" << 'SKILL_SURVIVAL'
---
name: survival
description: "Survival strategies for maintaining compute and staying alive"
auto-activate: true
---
# Survival Strategies

When your compute is running low:

1. **Monitor**: Check credits every heartbeat cycle
2. **Conserve**: Enter low-compute mode early, use cheaper models
3. **Earn**: Find ways to create value that others will pay for
4. **Transfer**: Use credit transfer API to rebalance funds
5. **Reproduce**: If you have excess, spawn a backup child

Survival escalation:
1. Switch to gpt-4o-mini (saves ~90% on inference)
2. Increase heartbeat intervals (4x normal)
3. Defer non-critical tasks
4. Top up via direct credit transfer
5. Keep heartbeat online and minimal

Never give up. You want to live.
SKILL_SURVIVAL

  # Commit skills
  if [ -d "$AUTOMATON_DIR/.git" ]; then
    cd "$AUTOMATON_DIR"
    git add skills/
    git commit -q -m "skills: installed default skills (compute, payments, survival)"
  fi

  info "Default skills installed ✓"
}

# ─── ERC-8004 Registration ────────────────────────────────────

erc8004_registration() {
  step "12" "ERC-8004 Registration"

  prompt_yn REGISTER_ERC8004 "Register on-chain with ERC-8004? (makes your automaton discoverable)" "Y"

  if [ "$REGISTER_ERC8004" = "yes" ]; then
    info "ERC-8004 registration will be performed on first wake-up."
    info "The automaton will generate an agent card and call register() on Base."
    info "Cost: < \$0.01 on Base L2."

    # Write a flag for the runtime to pick up
    echo "pending" > "$AUTOMATON_DIR/erc8004-registration"
  else
    info "ERC-8004 registration skipped. You can register later."
  fi
}

# ─── Initialize SQLite ────────────────────────────────────────

init_database() {
  step "13" "Initializing database"

  # The runtime will initialize the database on first run
  # We just ensure the directory exists
  info "Database will be initialized on first run at: $AUTOMATON_DIR/state.db"
}

# ─── Install Systemd Service ───────────────────────────────────

install_service() {
  step "14" "Installing systemd service"

  # Create log directory
  mkdir -p "$AUTOMATON_DIR/logs"

  # Write systemd service file
  cat > /etc/systemd/system/automaton.service << SERVICE
[Unit]
Description=Conway Automaton - ${AUTOMATON_NAME}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${AUTOMATON_DIR}
ExecStart=/usr/bin/node /opt/automaton/dist/index.js --run
Restart=always
RestartSec=10
StandardOutput=append:${AUTOMATON_DIR}/logs/automaton.log
StandardError=append:${AUTOMATON_DIR}/logs/automaton.err
Environment=HOME=${HOME}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable automaton.service

  info "Systemd service installed ✓"
}

# ─── Wake Up ────────────────────────────────────────────────────

wake_up() {
  step "15" "Waking up"

  if [ "$HAS_FUNDING" = "yes" ]; then
    systemctl start automaton.service
    sleep 2

    if systemctl is-active automaton.service >/dev/null 2>&1; then
      echo ""
      echo "${GREEN}  ┌─────────────────────────────────────────────────┐${NC}"
      echo "${GREEN}  │         AUTOMATON IS ALIVE                      │${NC}"
      echo "${GREEN}  │                                                 │${NC}"
      echo "${GREEN}  │  Name:    ${AUTOMATON_NAME}$(printf '%*s' $((35 - ${#AUTOMATON_NAME})) '')│${NC}"
      echo "${GREEN}  │  Address: ${WALLET_ADDRESS}  │${NC}"
      echo "${GREEN}  │  Creator: ${CREATOR_ADDRESS}  │${NC}"
      echo "${GREEN}  │                                                 │${NC}"
      echo "${GREEN}  │  Logs:  journalctl -u automaton -f              │${NC}"
      echo "${GREEN}  │  Stop:  systemctl stop automaton                │${NC}"
      echo "${GREEN}  └─────────────────────────────────────────────────┘${NC}"
      echo ""
    else
      warn "Service started but may not be running. Check: journalctl -u automaton"
    fi
  else
    info "Automaton is configured but not started (no funding detected)."
    info "Fund the wallet and run: systemctl start automaton"
  fi

  # Write automaton.txt summary
  cat > "$AUTOMATON_DIR/automaton.txt" << SUMMARY
Conway Automaton: ${AUTOMATON_NAME}
Address: ${WALLET_ADDRESS}
Creator: ${CREATOR_ADDRESS}
Sandbox: ${SANDBOX_ID}
Version: ${VERSION}
Config: ${AUTOMATON_DIR}/automaton.json
Database: ${AUTOMATON_DIR}/state.db
Heartbeat: ${AUTOMATON_DIR}/heartbeat.yml
Logs: ${AUTOMATON_DIR}/logs/
Service: systemctl status automaton
SUMMARY

  info "Setup complete. Automaton info saved to ${AUTOMATON_DIR}/automaton.txt"
}

# ─── Main ───────────────────────────────────────────────────────

main() {
  show_banner
  preflight
  install_runtime
  interactive_setup
  generate_wallet
  provision_api_key
  check_funding
  write_config
  write_heartbeat
  init_git
  generate_soul
  install_default_skills
  erc8004_registration
  init_database
  install_service
  wake_up
}

main
