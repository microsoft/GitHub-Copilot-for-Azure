/**
 * Custom ESLint rule: integration-test-name
 *
 * Enforces that the top-level describe() call in integration.test.ts files
 * uses a name matching a specific pattern.
 *
 * Update DESCRIBE_NAME_PATTERN below to enforce your desired format.
 */

// Placeholder regex — update this to match your naming convention.
// The test name must begin with the exact skill name terminated by an underscore, followed by an optional suffix and then the fixed " - Integration Tests" label.
// Current pattern:
// - without the optional suffix after skill name "<lowercase-kebab-case-skill-name>_ - Integration Tests"
// - with the optional suffix after skill name "<lowercase-kebab-case-skill-name>_<test-name-suffix> - Integration Tests"
const DEFAULT_NAME_PATTERN = /^[a-z0-9-]+_[a-z0-9-]* - Integration Tests$/;

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
                "Enforce a consistent naming format for top-level describe() blocks in integration test files.",
    },
    messages: {
      badName:
                "Top-level describe name \"{{actual}}\" does not match the required pattern: {{pattern}}",
      mustStartWithSkillName:
                "Top-level describe name must be a template literal starting with ${SKILL_NAME}, e.g. `${SKILL_NAME} - Integration Tests`",
    },
    schema: [
      {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "A regex string the describe name must match.",
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    // Allow overriding the pattern via rule options
    const patternStr = context.options?.[0]?.pattern;
    const pattern = patternStr ? new RegExp(patternStr) : DEFAULT_NAME_PATTERN;

    return {
      CallExpression(node) {
        // Only care about top-level describe() calls (depth === Program > ExpressionStatement > CallExpression)
        const parent = node.parent;
        const grandparent = parent?.parent;
        if (grandparent?.type !== "Program") {
          return;
        }

        const callee = node.callee;

        // Match describe(...) or describe.skip(...) or describe.only(...)
        const isDescribe =
                    (callee.type === "Identifier" && callee.name === "describe" || callee.name === "describeIntegration") ||
                    (callee.type === "MemberExpression" &&
                        callee.object?.type === "Identifier" &&
                        callee.object.name === "describe");

        if (!isDescribe) {
          return;
        }

        const firstArg = node.arguments[0];
        if (!firstArg) {
          return;
        }

        // Must be a template literal
        if (firstArg.type !== "TemplateLiteral") {
          context.report({
            node: firstArg,
            messageId: "mustStartWithSkillName",
          });
          return;
        }

        // Must have at least one expression, and it must start with ${SKILL_NAME}
        const firstQuasi = firstArg.quasis[0]?.value.cooked ?? "";
        const firstExpr = firstArg.expressions[0];
        if (
          firstQuasi !== "" ||
                    !firstExpr ||
                    firstExpr.type !== "Identifier" ||
                    firstExpr.name !== "SKILL_NAME"
        ) {
          context.report({
            node: firstArg,
            messageId: "mustStartWithSkillName",
          });
          return;
        }

        // Build a synthetic string replacing expressions with a representative placeholder
        // and validate the overall format against the pattern
        const parts = [];
        for (let i = 0; i < firstArg.quasis.length; i++) {
          parts.push(firstArg.quasis[i].value.cooked ?? "");
          if (i < firstArg.expressions.length) {
            parts.push("placeholder");
          }
        }
        const synthesized = parts.join("");
        if (!pattern.test(synthesized)) {
          context.report({
            node: firstArg,
            messageId: "badName",
            data: {
              actual: synthesized,
              pattern: pattern.toString(),
            },
          });
        }
      },
    };
  },
};

export default rule;
