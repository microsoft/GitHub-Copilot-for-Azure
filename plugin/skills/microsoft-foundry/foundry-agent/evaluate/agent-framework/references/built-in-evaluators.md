# Built-in Evaluators

Use `BuiltInEvaluatorConfig(name, threshold)` in `@evals.evaluator(...)`.

## Agent Evaluators

| Evaluator | Type | Description |
|-----------|------|-------------|
| `task_adherence` | Prompt-based | Assesses how well an AI-generated response follows the assigned task based on alignment with instructions and definitions, accuracy and clarity of the response, and proper use of provided tool definitions. |
| `intent_resolution` | Prompt-based | Assesses whether the user intent was correctly identified and resolved. |
| `tool_call_accuracy` | Prompt-based | Assesses how accurately an AI uses tools by examining relevance to the conversation, parameter correctness according to tool definitions, and parameter value extraction from the conversation. |
| `tool_selection` | Prompt-based | Evaluates whether an AI agent selected the most appropriate and efficient tools for a given task, avoiding redundancy or missing essentials. |
| `task_completion` | Prompt-based | Evaluates whether an AI agent successfully completed the requested task end to end by analyzing the conversation history and agent response to determine if all task requirements were met. |
| `tool_call_success` | Prompt-based | Evaluates whether all tool calls were successful or not. Checks all tool calls to determine if any resulted in technical failure like exception, error, or timeout. |
| `tool_input_accuracy` | Prompt-based | Checks whether all parameters in an agent's tool call are correct, validating grounding, type, format, completeness, and contextual appropriateness. |
| `tool_output_utilization` | Prompt-based | Checks if an agent correctly interprets and contextually uses the outputs returned by invoked tools without fabrication or omission. |

## General Purpose

| Evaluator | Type | Description |
|-----------|------|-------------|
| `coherence` | Prompt-based | Assesses the ability of the language model to generate text that reads naturally, flows smoothly, and resembles human-like language. |
| `fluency` | Prompt-based | Assesses the extent to which the generated text conforms to grammatical rules, syntactic structures, and appropriate vocabulary usage. |
| `relevance` | Prompt-based | Assesses the ability of answers to capture the key points of the context and produce coherent and contextually appropriate outputs. |

## RAG Evaluators

| Evaluator | Type | Description | Dataset Fields |
|-----------|------|-------------|----------------|
| `groundedness` | Prompt-based | Assesses the correspondence between claims in an AI-generated answer and the source context, making sure that these claims are substantiated by the context. | `context` |
| `retrieval` | Prompt-based | Assesses the AI system's performance in retrieving information for additional context (e.g. a RAG scenario). | `context` |
| `response_completeness` | Prompt-based | Assesses how thoroughly an AI model's generated response aligns with the key information, claims, and statements established in the ground truth. | `ground_truth` |

## Similarity Evaluators

| Evaluator | Type | Description | Dataset Fields |
|-----------|------|-------------|----------------|
| `similarity` | Code-based | Evaluates the likeness between a ground truth sentence and the AI model's generated prediction using sentence-level embeddings. | `ground_truth` |
| `f1_score` | Code-based | Calculates F1 score. | `ground_truth` |
| `bleu_score` | Code-based | Calculates BLEU score. | `ground_truth` |

> **Dataset Fields**: Additional columns required in the JSONL dataset beyond `query`. The plugin auto-extracts `response`, `tool_calls`, and `tool_definitions` from the agent.
