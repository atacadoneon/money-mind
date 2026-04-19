/**
 * MONEY MIND — Conventional Commits
 * Docs: https://www.conventionalcommits.org/
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // nova feature
        "fix",      // bug fix
        "docs",     // documentacao
        "style",    // formatacao, sem mudanca de logica
        "refactor", // refatoracao sem feat nem fix
        "perf",     // performance
        "test",     // testes
        "build",    // build system / deps
        "ci",       // pipelines
        "chore",    // manutencao
        "revert",   // reverts
        "security", // fixes de seguranca
      ],
    ],
    "scope-enum": [
      1,
      "always",
      [
        "api",
        "web",
        "db",
        "auth",
        "billing",
        "accounts-payable",
        "accounts-receivable",
        "reconciliation",
        "integrations",
        "tiny",
        "conta-simples",
        "pagarme",
        "tenants",
        "users",
        "reports",
        "docs",
        "ci",
        "deps",
        "infra",
        "security",
        "observability",
        "scripts",
        "packages",
        "deps-dev",
        "release",
      ],
    ],
    "subject-case": [2, "always", "sentence-case"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [1, "always", 120],
  },
};
