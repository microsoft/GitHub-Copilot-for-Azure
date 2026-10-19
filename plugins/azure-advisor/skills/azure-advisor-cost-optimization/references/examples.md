# Advisor routing examples

Use these examples as routing patterns, not fixed response templates.

| User request | Route and expected next step |
|---|---|
| “Show unused resources and potential savings.” | Resolve scope, call the grouped `Cost` + `IdleResources` summary, show type-level results, then ask which type to expand. |
| “Show the unused App Service plans.” | Resolve scope, identify the exact returned recommendation type, then list only that type with `category=Cost`, `sub-category=IdleResources`, and `status=New`; render its resources and stop with a next step such as inspecting another type. Do not ask for resource selection unless the user requests an actionability or state-changing follow-up. |
| “Create a script to remove these.” | Query active findings with `advisor_recommendation_list` using `category=Cost`, `sub-category=IdleResources`, and `status=New`; require explicit type and resource selection, then hand the selected rows to `azure-advisor-actionability`. |
| “Postpone this one.” after multiple rows | Render the returned rows first, then ask the user to identify the exact resource. After selection, show the proposed date and request confirmation. |
| “What did we save last quarter?” | List `Completed` idle-resource findings, filter by the returned deletion date, and report only Advisor/ARG-returned realized savings. |
| “Dismiss all of these.” | Limit the target to the selected recommendation type and scope; show every resource, request a reason, and confirm before one update per stable recommendation ID. |

In every route, preserve scope, lifecycle state, currency, pricing basis,
truncation, and unavailable values in the response.
