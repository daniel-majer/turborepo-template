/**
 * Commitlint configuration
 * @type {import("@commitlint/types").UserConfig}
 * https://www.conventionalcommits.org/en/v1.0.0/#summary
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [2, "never"],
    "scope-enum": [2, "always", ["fe", "be", "tooling", "deps", "deps-dev"]],
    "scope-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "type-empty": [2, "never"],
  },
  ignores: [(commit) => commit.startsWith("Merge ")],
};
