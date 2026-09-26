import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import globalsPkg from "globals";

const browserGlobals = globalsPkg.browser;

export default [
  js.configs.recommended,
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: null,
      },
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        crypto: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      "react-hooks": reactHooks,
    },
    rules: {
      ...ts.configs.recommended.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["webapp/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...browserGlobals,
        React: "readonly",
        JSX: "readonly",
        NodeJS: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts"],
    ignores: ["dist/", "node_modules/"],
  },
];
