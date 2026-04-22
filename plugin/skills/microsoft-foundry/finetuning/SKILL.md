---
name: finetuning
description: "Fine-tune models on Azure AI Foundry using SFT (supervised), DPO (preference), or RFT (reinforcement with graders). Covers dataset preparation, training job submission, deployment, and evaluation."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Fine-Tuning on Azure AI Foundry

Fine-tune models using SFT (supervised), DPO (preference), or RFT (reinforcement with graders). Covers dataset prep, training, deployment, and evaluation.

## Workflows

| Stage | Guide |
|-------|-------|
| **Quick start** | [workflows/quickstart.md](workflows/quickstart.md) |
| **Full pipeline** | [workflows/full-pipeline.md](workflows/full-pipeline.md) |
| **Create data** | [workflows/dataset-creation.md](workflows/dataset-creation.md) |
| **Iterate** | [workflows/iterative-training.md](workflows/iterative-training.md) |
| **Diagnose** | [workflows/diagnose-poor-results.md](workflows/diagnose-poor-results.md) |

## References

| Topic | File |
|-------|------|
| SFT vs DPO vs RFT | [references/training-types.md](references/training-types.md) |
| Hyperparameters | [references/hyperparameters.md](references/hyperparameters.md) |
| Data formats | [references/dataset-formats.md](references/dataset-formats.md) |
| Grader design (RFT) | [references/grader-design.md](references/grader-design.md) |
| Reward hacking | [references/reward-hacking.md](references/reward-hacking.md) |
| Agentic RFT (tools) | [references/agentic-rft.md](references/agentic-rft.md) |
| Deployment | [references/deployment.md](references/deployment.md) |
| Training curves | [references/training-curves.md](references/training-curves.md) |
| Evaluation | [references/evaluation.md](references/evaluation.md) |
| Vision fine-tuning | [references/vision-fine-tuning.md](references/vision-fine-tuning.md) |
| Large file uploads | [references/large-file-uploads.md](references/large-file-uploads.md) |
| Platform gotchas | [references/platform-gotchas.md](references/platform-gotchas.md) |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/submit_training.py` | Submit SFT/DPO/RFT jobs |
| `scripts/monitor_training.py` | Poll job until completion |
| `scripts/calibrate_grader.py` | Find optimal RFT pass_threshold |
| `scripts/check_training.py` | Analyze curves, list checkpoints |
| `scripts/deploy_model.py` | Deploy via ARM REST API |
| `scripts/evaluate_model.py` | LLM judge evaluation |
| `scripts/convert_dataset.py` | Convert between SFT/DPO/RFT formats |
| `scripts/generate_distillation_data.py` | Generate synthetic training data |
| `scripts/score_dataset.py` | Quality scoring on training data |
| `scripts/cleanup.py` | Delete old files and deployments |
| `scripts/validate/` | Data validators (SFT, DPO, RFT) + stats |

## Rules

1. **Always baseline first** — evaluate the base model before fine-tuning
2. **Validate data** before submitting — run `scripts/validate/validate_sft.py`
3. **Calibrate RFT graders** — target 25-50% failure rate on the base model
4. **Evaluate checkpoints** — don't blindly deploy the final one
5. **Measure token cost** alongside accuracy when comparing models
