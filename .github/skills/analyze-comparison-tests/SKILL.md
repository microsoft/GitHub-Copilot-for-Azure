---
name: analyze-comparison-tests
description: "Collects comparison test run artifacts and answer user's questions based on the trajectories of each run."
disable-model-invocation: true
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Steps

1. Collect run artifacts

Execute the collect-artifacts script to download the test run artifacts.

- bash: [collect-artifacts.sh](./scripts/collect-artifacts.sh)
- powershell: [collect-artifacts.ps1](./scripts/collect-artifacts.ps1)

The user must provide an JSON file to correlate each comparison test run with the GitHub Actions run. The script expects one input argument as the path to this JSON file.

```bash
collect-artifacts.sh input.json
```

The collect-artifacts script will download the test run artifacts to a directory named `comparison-artifacts` in the current working directory. Before executing the script, check if there is already such an directory. If so, skip executing the script and proceed to step 2.

2. Extract insights

The downloaded artifacts will have the following folder structure:

```text
comparison-artifacts/
├── <stimulus-name-1>/
│   ├── <model>-with-skill/
│   │   ├── agent-metadata-<date-string-1>.md
│   │   ├── agent-metadata-<date-string-2>.md
│   │   └── ...
│   └── <model>-without-skill/
│       ├── agent-metadata-<date-string-1>.md
│       ├── agent-metadata-<date-string-2>.md
│       └── ...
└── <stimulus-name-2>/
    ├── <model>-with-skill/
    │   └── agent-metadata-*.md
    └── <model>-without-skill/
        └── agent-metadata-*.md
```

Each `<stimulus-name>/<model>-with-skill` or `<stimulus-name>/<model>-without-skill` directory contains the test run trajectories for that stimulus using the specified model with or without skills. Each trajectory is a markdown file that records user prompts, tool call requests, tool execution results, assistant responses that happened during the run. It also contains statistics such as token usage and turns. Based on the trajectories, answer the user's questions for each test run. Generate a report following the [report-template](./references/report-template.md) to show your answers.
