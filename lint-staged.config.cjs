/**
 * MONEY MIND — lint-staged
 * Roda em arquivos staged no pre-commit.
 */
module.exports = {
  "*.{ts,tsx,js,jsx,cjs,mjs}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "*.{css,scss}": ["prettier --write"],
};
