# Contributing to LogOS Core

Welcome to LogOS Core! Here is our standard development, review, and deployment process.

## Development Workflow

1. **Branching**: Create a new branch for your feature or bug fix.
2. **Local Development**: Run `npm run dev` to start the local development server. Ensure all code passes `npm run typecheck` and `npm run build` locally.
3. **Commiting**: Commit your changes and push them to your branch on GitHub.

## CI/CD Pipeline

We use GitHub Actions to automate testing and deployments.

1. **Pull Request (PR)**: Open a PR against the `main` branch.
2. **Continuous Integration (CI)**: The PR will trigger CI checks:
   - TypeScript compilation checks (`npm run typecheck`).
   - Production build tests (`npm run build`).
3. **Jules Review Gate**: All PRs into `main` require a review from Jules before they can be merged. Jules will check that:
   - The build passes successfully.
   - There are no hardcoded secrets in the source code.
   - The code follows the `AGENTS.md` conventions (e.g., dark theme, gold accent, Playfair headings).
   - There are no unauthorized changes to `wrangler.toml` bindings.
4. **Merge**: Once Jules approves the PR (and TARS approval is obtained), the PR can be merged into `main`.
5. **Auto-Deploy**: Merging into `main` automatically triggers the deployment to Cloudflare Workers via `.github/workflows/deploy.yml`.

## Deployment Actions

- **Manual Deployment**: Trigger a manual deployment using the `workflow_dispatch` trigger in GitHub Actions.
- **Backup Pipeline**: Run `npm run deploy:backup` to build, deploy, and commit the deploy state to git.
- **Rollback**: Run `npm run rollback` to revert to the last successfully deployed version.

Ensure your `CLOUDFLARE_API_TOKEN` environment variable is set when using the backup deploy or rollback scripts locally.
