# Plugin evaluation metrics

This document defines the core evaluation metrics for skills in the `azure` plugin. Evaluations run Vally suites and use graders to assess the resulting agent trajectories.

> Note: These metrics are also recommended metrics for all plugin authors to evaluate their skills. We recommend plugin authors to contribute integration tests that evaluates their skills using these metrics when contributing skills.

## Skill invocation success rate

Agents are designed to load skills automatically when relevant. Each skill's description should guide the model to load it in appropriate situations without explicit cues from the user, such as a slash command or a reference to the skill by name.

The skill invocation success rate measures how often the agent loads a skill in response to test prompts intended to trigger it. This rate is compared against a threshold (by default 75%) to determine whether invocation is sufficiently reliable.

## Skill effectiveness

Skills are designed to improve agent behavior in two ways:

- **Reduce token usage** by providing relevant context and instructions, so the agent does not need to discover and interpret that information independently.
- **Guide decisions** toward preferred outcomes. For example, a skill might encourage Microsoft Entra authentication rather than key-based authentication to improve security.

In this document, *skill effectiveness* refers to the second benefit: a skill's ability to influence the model's decisions.

Skill effectiveness is measured using test prompts whose outcomes depend on the model's decisions. Graders check both whether the skill was loaded and whether the model made the desired decisions after reading it. A decision-related grading failure after the skill was loaded indicates that the skill did not produce the intended behavior.

When read, skills should consistently guide the model toward the desired decisions, allowing for occasional hallucinations. Skill authors should investigate recurring effectiveness failures.

## Baseline performance

New model generations can change default behavior in target scenarios, reducing the value of an existing skill or creating a need for a new one. *Baseline performance* measures how well the model makes the desired decisions without a skill.

Baseline performance is measured using the same prompts as the skill effectiveness tests, but without skills in the agent's context. The agent completes the tasks independently. Graders assess its decisions but omit skill-specific checks, such as whether a skill was loaded or a reference file was read.

For skills intended to guide decisions, baseline performance is expected to be poor: without the skill, the agent often makes undesirable decisions in the target scenarios. If baseline performance becomes consistently strong, skill authors should reassess whether the skill still adds enough value to retain.
