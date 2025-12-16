## 2024-07-29 - Keep PRs Focused

**Learning:** Mixing dependency and configuration changes with performance optimizations in the same PR is a bad practice. It increases the review complexity and risk, and goes against the principle of single responsibility for a commit. I received feedback to revert the ESLint and `package.json` changes and keep the PR focused solely on the memoization optimization.

**Action:** In the future, I will always create separate PRs for tooling/configuration changes and for feature/performance work. If a configuration change is a prerequisite, I will make it in a separate, preceding PR. I will also remember to ask before adding any new dependencies, as per my instructions.