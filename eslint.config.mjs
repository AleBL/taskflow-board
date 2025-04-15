import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "drizzle/**", "patches/**", "client/public/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["server/**", "api/**", "scripts/**", "shared/**"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["client/**"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    rules: {
      "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0, maxBOF: 0 }],
      "no-trailing-spaces": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "no-useless-assignment": "off",
    },
  },
);
