# Contributing

Thanks for your interest in contributing to Automaton.

## Quick Start

1. Fork the repo and create a feature branch.
2. Install dependencies.
3. Make focused changes.
4. Run checks before opening a PR.

## Local Checks

From repo root:

- `./scripts/quality-check.sh --quick`

From `web/`:

- `npm run lint`
- `npm run build`

## Pull Request Guidelines

- Keep PRs small and focused.
- Include a short summary and testing notes.
- Update docs when behavior changes.
- Do not include unrelated refactors.

## Security and Secrets

- Never commit secrets, keys, wallets, or `.env` files.
- Use `.env.example` as a template.
- If you discover a vulnerability, follow `SECURITY.md`.

## Code Style

- Match existing style in touched files.
- Prefer minimal, root-cause fixes.
- Avoid adding dependencies unless necessary.
