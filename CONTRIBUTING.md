# Contributing to 3BodySim

Thanks for your interest in contributing.

## Getting Started

1. Fork the repository and create a branch from `main`.
2. Install dependencies:
   - `npm install`
3. Start local development:
   - `npm run dev`

## Development Guidelines

- Keep changes focused and easy to review.
- Follow existing React + TypeScript patterns in the codebase.
- Avoid adding new dependencies unless clearly necessary.
- Place unit tests under `tests/unit/` and mirror `src/` feature paths when practical.
- Update docs when behavior or workflow changes.

## Validation Before Opening a PR

Run the following locally:

1. `npm run lint`
2. `npm run build`
3. `npm run test`

If your change affects behavior, add or update tests where applicable.

## Pull Requests

- Use a clear title and describe:
  - What changed
  - Why it changed
  - How it was validated
  - Test results (`npm run test`)
- Link related issues when relevant.
- Keep PRs scoped to one concern.

## Code of Conduct

By participating, you agree to follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
