import js from "@eslint/js";
import globals from "globals";
import tsEs from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tsEs.config(
  js.configs.recommended,
  ...tsEs.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "react-hooks/react-in-jsx-scope": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.js", "vite.config.ts", "tailwind.config.js", "eslint.config.js"],
  }
);
