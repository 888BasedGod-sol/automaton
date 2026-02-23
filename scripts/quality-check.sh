#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AUTOMATON Website Quality Check
# 
# Usage:
#   ./scripts/quality-check.sh          # Run all checks
#   ./scripts/quality-check.sh --quick  # Skip Claude review (faster)
#   ./scripts/quality-check.sh --review # Only run Claude review
# ═══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")/web"

cd "$WEB_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  AUTOMATON Website Quality Check                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Parse args
QUICK=false
REVIEW_ONLY=false
for arg in "$@"; do
  case $arg in
    --quick) QUICK=true ;;
    --review) REVIEW_ONLY=true ;;
  esac
done

# ───────────────────────────────────────────────────────────
# BUILD CHECK
# ───────────────────────────────────────────────────────────
if [ "$REVIEW_ONLY" = false ]; then
  echo "📦 Building..."
  npm run build > /dev/null 2>&1 && echo "   ✅ Build passed" || { echo "   ❌ Build failed"; exit 1; }

  # ───────────────────────────────────────────────────────────
  # LINT CHECK
  # ───────────────────────────────────────────────────────────
  echo ""
  echo "🔍 Linting..."
  npm run lint > /dev/null 2>&1 && echo "   ✅ Lint passed" || echo "   ⚠️  Lint warnings (non-blocking)"

  # ───────────────────────────────────────────────────────────
  # API TESTS
  # ───────────────────────────────────────────────────────────
  echo ""
  echo "🧪 Running API tests..."
  npm run test || true
fi

# ───────────────────────────────────────────────────────────
# CLAUDE REVIEW
# ───────────────────────────────────────────────────────────
if [ "$QUICK" = false ]; then
  echo ""
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Skipping Claude review (ANTHROPIC_API_KEY not set)"
    echo "   Set it with: export ANTHROPIC_API_KEY=your-key"
  else
    echo "🤖 Running Claude code review..."
    npm run review -- --focus=api || true
  fi
fi

# ───────────────────────────────────────────────────────────
# SUMMARY
# ───────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Quality check complete!"
echo ""
echo "Available commands:"
echo "  npm run test          # Run API tests"
echo "  npm run review        # Full Claude review"
echo "  npm run review:api    # Review API routes only"
echo "═══════════════════════════════════════════════════════════"
echo ""
