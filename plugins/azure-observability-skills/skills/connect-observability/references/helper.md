# Local helper

Requires an existing Python 3.9+ interpreter; persistence also requires Git.
Resolve the script relative to this skill, not the application's working folder.
Examples use Windows paths; adapt shell quoting for the current host.

```text
python "<skill-directory>\scripts\onboarding.py" validate "<mapping-input.json>"
python "<skill-directory>\scripts\onboarding.py" assess "<assessment-input.json>"
python "<skill-directory>\scripts\onboarding.py" save "<mapping-input.json>" --project "<app-repository>" --consent
python "<skill-directory>\scripts\onboarding.py" load --project "<app-repository>"
```

Use an already available interpreter; do not install Python without approval.
Errors return nonzero with a sanitized message. A successful `assess` command
means the input was classified, not that telemetry is ready: inspect its result.
No shell tools are pre-approved by this skill.
