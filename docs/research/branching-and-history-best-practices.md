# Branching and commit-history best practices

Reviewed on 2026-09-02. This compares the current official Linux kernel process with GitHub's documented workflow and merge guidance, then applies the useful parts to this small solo public repository. Sources are limited to official Linux kernel and GitHub documentation.

## Executive summary

Linux does not use one protected branch plus disposable pull-request branches. It uses a hierarchy of long-lived maintainer trees: Linus's mainline, stable trees, subsystem trees, and the `linux-next` integration tree. Changes move through reviewed patch series and tested maintainer branches before they reach mainline. GitHub Flow is intentionally lighter: create a short-lived branch for a change, commit and push it, open a pull request, pass checks and review, merge it, and delete the completed branch.

For `lynvo`, the right choice is to adopt GitHub's lightweight workflow while borrowing Linux's discipline around logical changes, testing, provenance, and release points:

1. Keep `main` protected and make it the only release source.
2. Use one short-lived branch per logical change or pull request, not one branch per commit.
3. Keep multiple commits on a branch when they are useful for review or rollback, but squash them into one `main` commit when the pull request represents one logical change.
4. Enable automatic deletion of merged head branches. The pull request and its review history remain available, and GitHub supports restoring the branch if needed.
5. Use annotated, preferably signed, tags for releases and important milestones—not for every temporary branch.

The current `main` ruleset already matches this recommendation: pull requests are required, the repository checks must pass, the branch must be up to date, force-push and deletion are blocked, and squash is the only allowed merge method. Because the repository currently has one collaborator, requiring an approval would not create an independent review: GitHub does not allow a pull-request author to approve their own pull request.

## What the Linux kernel does

### Branch and patch workflow

The kernel development process has several distinct lines of development: Linus's mainline tree, multiple stable trees, subsystem-specific trees, and `linux-next` for integration testing. Subsystem maintainers collect changes in their own trees, and the trees form a chain of trust before a selected set of changes is pulled into mainline. This is a maintainer hierarchy, not a single team's feature-branch queue. See the [kernel development HOWTO](https://docs.kernel.org/process/howto.html) and [how the kernel development process works](https://docs.kernel.org/process/2.Process.html).

Kernel contributors normally prepare a topical branch as a patch or patch series. Each patch should represent one logical change, and a series should remain buildable and usable at every step because people may bisect it. The submission should explain the problem, user impact, testing, and the base commit or branch on which it was prepared. The [patch submission guide](https://docs.kernel.org/process/submitting-patches.html) calls out the one-problem-per-patch and independently-verifiable-patch principles, while the [advanced Git guidance](https://docs.kernel.org/process/7.AdvancedTopics.html) describes the use of independent topic branches.

The review path is staged: early review on the relevant mailing list, wider review and integration in the subsystem tree and `linux-next`, then mainline integration, followed by stable-release and long-term maintenance. The kernel documentation explicitly treats review and integration as separate stages rather than reducing the process to a single merge. See [the patch lifecycle](https://docs.kernel.org/process/2.Process.html#the-lifecycle-of-a-patch).

### Review and commit history

The kernel records more than an approval decision. Patch metadata can include `Signed-off-by:`, `Reviewed-by:`, `Acked-by:`, `Tested-by:`, `Reported-by:`, `Suggested-by:`, and `Fixes:` trailers. The kernel's [patch-posting guidance](https://docs.kernel.org/process/5.Posting.html#5-4-tags-for-the-patch) and [submission guide](https://docs.kernel.org/process/submitting-patches.html#using-reported-by-tested-by-reviewed-by-suggested-by-and-fixes) explain how these preserve authorship, review, testing, bug origin, and release-backport information.

The kernel also links commits back to the archived review discussion. Its maintainer Git guidance recommends storing patch discussions in `lore.kernel.org` and adding a `Link:` trailer when a patch is applied, so the reasoning remains discoverable from the commit history. See [Configuring Git](https://docs.kernel.org/maintainer/configure-git.html#creating-commit-links-to-lore-kernel-org).

### Merge strategy and history rewriting

Linux is comfortable with merge commits because independent subsystem trees must be integrated. The kernel's [rebasing and merging guidance](https://docs.kernel.org/maintainer/rebasing-and-merging.html) says the project is not trying to eliminate merge commits, and it says that merge commits should explain why the merge was made. It also warns maintainers not to rewrite history that has been exposed publicly or contains another developer's history; if a published change is wrong, an explicit revert is generally safer than making it disappear.

For maintainer pull requests, the kernel uses signed tags. The tag describes what is being pulled, why it should be merged, and what testing was performed; that message becomes part of the permanent integration record. See [Creating Pull Requests](https://docs.kernel.org/maintainer/pull-requests.html) and the [maintainer PGP guide](https://docs.kernel.org/process/maintainer-pgp-guide.html).

### Branch deletion and release points

The kernel documentation describes long-lived subsystem and stable branches, plus finalized stable releases in separate version branches, rather than a delete-after-merge workflow. That is appropriate for a project with many maintainers and downstream users who need to locate, test, and integrate specific histories. Stable release rules are documented in [Everything you ever wanted to know about Linux -stable releases](https://docs.kernel.org/process/stable-kernel-rules.html).

The practical lesson is not to keep every development branch forever. It is to keep durable references to meaningful integration and release points, while allowing temporary work branches to be retired once their changes have landed.

## What GitHub recommends

### GitHub Flow

GitHub describes GitHub Flow as a lightweight, branch-based workflow: create a short, descriptive branch, make and commit changes there, open a pull request for discussion and review, merge it, and delete the completed branch. GitHub recommends descriptive commits and says an isolated, complete commit is easier to understand or revert. See [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow).

GitHub explicitly recommends deleting the branch after the pull request is merged. Its guidance says that deleting the branch does not delete the pull request or its commit history, and that the branch can be restored or the pull request reverted if necessary. See [deleting and restoring branches in a pull request](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/deleting-and-restoring-branches-in-a-pull-request). GitHub also supports [automatic deletion of merged head branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches).

### Pull-request review and protection

GitHub treats pull-request review as the place to discuss proposed changes, request changes, approve, and resolve conversations. Required status checks and required reviews can be enforced on protected branches or rulesets. GitHub's [protected-branch guidance](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) says strict status checks require the pull-request branch to be up to date with the base branch; this provides a stronger latest-base test but can require additional builds.

GitHub's [review guidance](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews) says reviews support comments, approvals, requests for changes, and conversation resolution. A [pull-request author cannot approve their own pull request](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews), so a solo repository can still benefit from protected pull requests and CI, but cannot obtain independent approval until another trusted collaborator is available.

### Merge methods and preserving commits

GitHub documents the trade-offs directly:

| Method | What reaches `main` | Best fit |
| --- | --- | --- |
| Merge commit | Every pull-request commit plus an explicit merge point | The individual commits are meaningful and complete history matters |
| Squash and merge | One new commit representing the pull request | One logical change, especially with fixups or work-in-progress commits |
| Rebase and merge | Each pull-request commit individually, with no merge commit | Commits are already organized and a linear history is wanted |

These are GitHub's documented behaviors in [Pull request merges](https://docs.github.com/en/pull-requests/reference/pull-request-merges). GitHub also notes that rebase-and-merge creates new commit SHAs, while squash-and-merge does not preserve the intermediate commits as separate commits on the base branch. Squashing works best for short-lived branches; if a branch continues after a squash merge, later pull requests can accidentally include changes that were already squashed, so a new branch should normally be created from the updated base.

## Linux versus GitHub Flow

| Concern | Linux kernel | GitHub's lightweight workflow | Implication for `lynvo` |
| --- | --- | --- | --- |
| Integration shape | Maintainer hierarchy, subsystem trees, stable trees, and `linux-next` | A branch and pull request feed a protected default branch | Use one protected `main` plus short-lived topic branches |
| Review | Mailing-list discussion, patch series, trailers, subsystem and integration testing | Pull-request discussion, reviews, required checks, and resolved conversations | Keep PRs focused, explain intent, run CI, and preserve the PR discussion |
| Mainline history | Individual patches and justified merge commits are valuable | Choose merge, squash, or rebase based on the meaning of the commits | Squash routine logical changes; use rebase when individual commits are intentionally valuable |
| History rewriting | Safe mainly in private work; avoid rewriting published or inherited history | GitHub can rebase-and-merge, but it creates new SHAs | Do not rewrite a branch after others depend on it; recreate short-lived branches after squash merges |
| Branch lifetime | Important maintainer and stable branches remain available | Merged head branches should normally be deleted | Auto-delete routine PR branches; retain tags and release references |
| Release identity | Signed tags and stable branches identify trusted release points | Releases are attached to tags and can include notes and assets | Tag released commits on `main`; do not use permanent branches as an archive for every PR |

## Recommendation for this repository

### Keep the current default

The current squash-only policy is appropriate for a small solo public repository. It keeps `main` readable and makes each merged pull request a clear unit of change. The intermediate commits still remain visible in the pull request while it is available, but they are not separate ancestors of `main` after a squash merge. This is the exact trade-off GitHub documents for squash merging.

Keep the existing `main` protections:

- require a pull request;
- require the successful verification, security, dependency-review, and CodeQL checks;
- require the branch to be up to date before merging;
- require conversation resolution;
- block force pushes and deletion;
- allow squash merging only while the repository remains solo-owned.

When another trusted maintainer joins, add an approval requirement or code-owner review. Until then, an approval count of zero is a practical limitation of GitHub's self-review rule, not a reason to remove the pull-request and CI gates.

### Use this branch routine

1. Update local `main` from `origin/main`.
2. Create one descriptive branch for one logical change or pull request.
3. Make as many meaningful commits as help review and testing; do not create a new branch for every small fixup.
4. Push that branch and keep using the same pull request while addressing feedback.
5. If `main` changes, update the branch so the required strict checks test the final merge context.
6. Squash-merge the pull request after checks and conversations are complete.
7. Let GitHub delete the merged head branch, then remove the stale local branch with `git branch -d` and refresh remote-tracking refs with `git fetch --prune`.

Do not reuse a branch after a squash merge. Start the next branch from the current `main`; this avoids carrying already-squashed commits into a later pull request, which GitHub specifically warns about for long-running branches.

### Preserve what is worth preserving

Use a release tag for every shipped version of the app or plugin server, and use a milestone tag only when a point is important enough to reproduce later. GitHub releases are built around tags and can contain release notes and downloadable assets; see [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository). For stronger provenance, use annotated signed tags for releases. Linux recommends signing tags used for maintainer pulls, and its [PGP guidance](https://docs.kernel.org/process/maintainer-pgp-guide.html) explains why tags are a useful integrity boundary.

Do not create an archival branch for every merged PR. The durable record should be:

- the squashed commit on `main`;
- the merged pull request and its review conversation;
- release or milestone tags when the point is significant;
- a revert commit if a landed change must be undone.

If the repository later develops multiple maintainers, release lines, or consumers who need to cherry-pick individual changes, revisit the merge policy. At that point, allowing rebase-and-merge can preserve intentional individual commits while keeping a linear `main`; allowing merge commits preserves the exact branch commits but adds visible integration points. Linux's maintainer-tree model should not be copied wholesale into this repository unless that complexity actually appears.

## Primary sources

### Linux kernel

- [HOWTO do Linux kernel development](https://docs.kernel.org/process/howto.html)
- [How the development process works](https://docs.kernel.org/process/2.Process.html)
- [Submitting patches](https://docs.kernel.org/process/submitting-patches.html)
- [Posting patches](https://docs.kernel.org/process/5.Posting.html)
- [Advanced Git topics](https://docs.kernel.org/process/7.AdvancedTopics.html)
- [Rebasing and merging](https://docs.kernel.org/maintainer/rebasing-and-merging.html)
- [Creating pull requests](https://docs.kernel.org/maintainer/pull-requests.html)
- [Configuring Git](https://docs.kernel.org/maintainer/configure-git.html)
- [Maintainer PGP guide](https://docs.kernel.org/process/maintainer-pgp-guide.html)
- [Stable kernel rules](https://docs.kernel.org/process/stable-kernel-rules.html)

### GitHub

- [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Pull request merges](https://docs.github.com/en/pull-requests/reference/pull-request-merges)
- [Managing branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository)
- [Deleting and restoring branches in a pull request](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/deleting-and-restoring-branches-in-a-pull-request)
- [Automatic deletion of branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches)
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [About pull-request reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews)
- [Approving a pull request with required reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews)
- [Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
