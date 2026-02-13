import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import jest from "eslint-plugin-jest";

const tsFiles = ["**/*.ts"];
const jsFiles = ["**/*.js", "**/*.mjs"];

// Shared rules for both TS and JS
const sharedRules = {
    // ESM enforcement - prohibit CommonJS syntax
    "no-restricted-syntax": [
        "error",
        {
            selector: "MemberExpression[object.name='module'][property.name='exports']",
            message: "Use ESM 'export' instead of 'module.exports'"
        },
        {
            selector: "MemberExpression[object.name='exports']",
            message: "Use ESM 'export' instead of 'exports.x'"
        }
    ],

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
};

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "reports/**",
            "**/resources/**",
            "**/__snapshots__/**",
            "swa-deployment-tests/**"
        ],
    },
    // TypeScript files - use TypeScript parser with project
    {
        files: tsFiles,
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommended,
        ],
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
            ...sharedRules,
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_"
            }],
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/await-thenable": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-require-imports": "error",
        },
    },
    // JavaScript files - no TypeScript project needed
    {
        files: jsFiles,
        extends: [
            eslint.configs.recommended,
        ],
        plugins: {
            jest,
        },
        languageOptions: {
            globals: {
                console: "readonly",
                process: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                Buffer: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearTimeout: "readonly",
                clearInterval: "readonly",
            },
        },
        rules: {
            ...sharedRules,
            // Prohibit require() in JS files
            "no-restricted-globals": ["error", {
                name: "require",
                message: "Use ESM 'import' instead of 'require()'"
            }],
        },
    }
);
