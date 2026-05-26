# AI Usage Audit

Deterministic spend-audit app for comparing AI tool subscriptions and API usage. The form captures team size, primary use case, usage intensity, and per-tool spend, then produces a savings breakdown with recommended plan adjustments.

## What it does

- Tracks spend for Cursor, GitHub Copilot, Claude, ChatGPT, and API-backed usage.
- Lets you choose a usage intensity band so recommendations can distinguish light, standard, and heavy workloads.
- Adds new tool rows to the top of the list as blank drafts until a tool is selected.

## Validation

- Production build passes with `npm run build`.