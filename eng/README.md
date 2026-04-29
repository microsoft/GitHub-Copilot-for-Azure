To clean up resource groups in the testing subscription, navigate to the `eng/scripts` directory and run the following command. This script primarily tags non-compliant groups with `DeleteAfter`; it only deletes groups that already have an expired `DeleteAfter` tag:


```.\test-sub-cleanup.ps1 -TenantId [TenantID] -SubscriptionId [SubscriptionID] -Login -DeleteNonCompliantGroups -DryRun -Verbose```

Review the `-DryRun` output first. When you are ready to apply changes, rerun the command without `-DryRun`. If you need to skip confirmation prompts during an intentional cleanup, add `-Force`.
