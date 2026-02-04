import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import jest from "eslint-plugin-jest";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        plugins: {
            jest,
        },
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // TypeScript rules
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_"
            }],
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/await-thenable": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-require-imports": "off",

            // Jest rules
            "jest/expect-expect": "error",
            "jest/no-disabled-tests": "warn",
            "jest/no-focused-tests": "error",
            "jest/valid-expect": "error",
            "jest/no-identical-title": "error",
            "jest/no-duplicate-hooks": "error",

            // General rules
            "no-console": "off",
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always", { null: "ignore" }],
            "quotes": ["error", "double", { "avoidEscape": true }],
        },
    },
    {
        // Relaxed rules for utility files that legitimately use console
        files: ["**/utils/**/*.ts", "**/scripts/**/*.ts"],
        rules: {
            "no-console": "off",
        },
    },
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "reports/**",
            "**/resources/**",
            "**/__snapshots__/**",
            "**/*.js",
        ],
    }
);
