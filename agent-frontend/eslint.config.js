import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {ignores: ["dist"]},
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The v7 "recommended" preset bundles React-Compiler-oriented advisory
      // rules. `set-state-in-effect` flags legitimate, established patterns used
      // across this app (syncing props into local state, resetting responsive UI
      // state on a breakpoint change) that are not bugs, so we keep it off rather
      // than rewrite unrelated components or scatter inline suppressions.
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": ["warn", {allowConstantExport: true}],
    },
  },
  prettier,
);
