import eslint from "@eslint/js";
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint";

const tsFiles = ["**/*.ts"];

export default defineConfig(
    // Global ignores
    {
        ignores: [
            "node_modules/**",
            "dist/**",
        ],
    },
    // TypeScript files - use TypeScript parser with project
    {
        files: tsFiles,
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommended,
        ],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.eslint.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // General rules
            "no-console": "off",
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always", { null: "ignore" }],
            "quotes": ["error", "double", { "avoidEscape": true }],

            // TypeScript rules
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_"
            }],
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/await-thenable": "error",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-require-imports": "warn"
        },
    },
);
