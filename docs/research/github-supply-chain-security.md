# GitHub supply-chain security review

Reviewed on 2026-09-02. This covers GitHub's [supply-chain security overview](https://docs.github.com/en/code-security/concepts/supply-chain-security/) and its linked guidance for dependencies, Dependabot, GitHub Actions, builds, releases, and provenance.

## Executive summary

The repository already has a strong baseline: Dependabot security features, secret scanning with push protection, SHA-pinned Actions, read-only default workflow permissions, frozen pnpm installs, a separate build/publish flow, and npm trusted publishing with provenance.

The highest-value follow-ups are:

1. Protect `main` and make dependency review, CodeQL, and verification required checks.
2. Review the two open CodeQL alerts in `apps/lynvo/app/lib/client-profile.ts:18`.
3. Add a required reviewer to the `production` environment.
4. Enforce full-length commit-SHA pinning at the repository or organization level.
5. Add GitHub artifact attestations if we want provenance for the built application/plugin artifacts, not only the npm package.

## What is already working well

- Dependabot alerts, security updates, automated security fixes, secret scanning, and push protection are enabled. At review time, the repository had zero open Dependabot alerts and zero open secret-scanning alerts.
- All current workflow actions are pinned to full commit SHAs, and `.github/dependabot.yml` checks GitHub Actions monthly. GitHub recommends SHA pinning because tags and branches can move. See the [secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use).
- Workflow permissions default to read-only, with write permissions scoped to CodeQL security events and npm's OIDC trusted publishing job.
- The [dependency review workflow](../../.github/workflows/dependency-review.yml) already fails for high-severity dependency changes.
- The [npm publish workflow](../../.github/workflows/publish-npm.yml) builds on one job, transfers a short-lived artifact, verifies its SHA-256 checksum, and publishes with `--provenance`. This is a good separation between build and publish.
- The workspace uses a lockfile and frozen CI installs, plus pnpm policies such as minimum release age, no dependency downgrades, blocked exotic subdependencies, strict dependency builds, and an explicit build allowlist.

## Recommended follow-ups

### 1. Protect `main`

The repository currently has no branch protection or ruleset for `main`. GitHub's [protected branch guidance](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) explains that a check only blocks merging when it is required by branch protection.

That means the existing dependency-review and CodeQL workflows provide visibility, but are not currently merge gates. Require pull requests and the successful checks from dependency review, CodeQL, and the normal verification workflow. Add at least one trusted review, and enable code-owner review once a `CODEOWNERS` file exists.

### 2. Review the open CodeQL findings

There are two open instances of `js/bad-code-sanitization` at the same static bootstrap script in [`client-profile.ts`](../../apps/lynvo/app/lib/client-profile.ts#L18). The value currently contains no user-controlled interpolation, so this may be a false positive or a duplicate alert, but it should be explicitly reviewed. CodeQL's [query guidance](https://codeql.github.com/codeql-query-help/javascript/js-bad-code-sanitization/) recommends avoiding dynamically constructed JavaScript and sanitizing any value that can enter it.

Prefer removing the raw inline-script surface if practical. If the script is proven safe and cannot be refactored without losing the required bootstrap behavior, record the reasoning and dismiss or suppress the alert according to the repository's review policy. Do not silently ignore it.

### 3. Require approval before production deploys

The `production` environment currently has branch restrictions but no required reviewer rule. The deploy job can access production Cloudflare, Google, and plugin secrets. GitHub's [Actions security guidance](https://docs.github.com/en/actions/reference/security/secure-use) recommends environment protection rules for sensitive deployments. Add one or more required reviewers, and keep the deploy job's environment boundary intact.

The `npm` environment should also be reviewed as a release-control boundary. Trusted publishing is already a good choice because it uses short-lived OIDC credentials instead of a long-lived npm token.

### 4. Enforce Action pinning as policy

The current workflows are already SHA-pinned, but repository policy currently allows all actions and does not require SHA pinning. Enabling the SHA-pinning requirement prevents future workflow changes from accidentally introducing floating action tags. Keep Dependabot enabled so approved action updates can still be reviewed and merged.

### 5. Consider GitHub artifact attestations

GitHub's [artifact attestation guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations) supports signing build outputs with `actions/attest`, using `id-token: write` and `attestations: write`, and verifying them with `gh attestation verify`. This would complement the npm registry's existing `--provenance` record. It is most useful for release archives, plugin-server artifacts, or deployable bundles that consumers obtain from GitHub Actions or Releases.

This should be a separate change because it adds permissions and a release-verification contract. Pin the attestation action to a reviewed commit SHA when implementing it.

### 6. Keep runtime and package-manager behavior explicit

The workflows use `pnpm/setup` to install Node through `pnpm runtime`. Since pnpm v11, that runtime intentionally omits npm, npx, and Corepack; the [pnpm runtime documentation](https://pnpm.io/cli/runtime) says to install npm separately only when a job actually needs it. The verification and deployment jobs do not need npm, so their floating npm installs were removed. The npm publish job uses `actions/setup-node`, whose official Node distribution includes npm, and retains the runtime-version check needed for trusted publishing.

The user-requested `pnpm/setup` `next-12` channel remains floating by design. That gives the latest pnpm 12 release but reduces reproducibility, so it should remain an explicit policy choice.

## Useful but lower priority

- Add `CODEOWNERS` entries for `.github/workflows/`, `.github/dependabot.yml`, and other security-sensitive configuration, then require code-owner review. GitHub specifically calls out workflow protection in its [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).
- Add Dependabot grouping for routine npm or Actions updates if update PR volume becomes noisy. Keep security updates reviewable and avoid broad groups that hide unrelated risk. See [Dependabot pull requests](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-pull-requests).
- Enable immutable releases if the project starts distributing artifacts through GitHub Releases. It protects published release tags and assets, but it does not replace branch/tag protection or npm trusted publishing. See [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).
- Dependency submission is not needed now if the pnpm lockfile fully describes the installed graph. GitHub says lockfiles are the most reliable source for the dependency graph; consider submission only if build-time dependencies are missing from the static graph. See [dependency graph data](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-graph-data).
- Review maintainer account security separately: GitHub recommends 2FA, passkeys or security keys, more than one recovery method, and downloaded recovery codes. See [securing accounts](https://docs.github.com/en/code-security/tutorials/implement-supply-chain-best-practices/securing-accounts).

GitHub settings were not changed during this review. The follow-up workflow changes correct the full `pnpm/setup` SHA and remove unnecessary floating npm installs.
