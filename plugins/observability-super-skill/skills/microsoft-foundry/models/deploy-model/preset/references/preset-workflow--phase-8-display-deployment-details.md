# Selected guidance: Phase 8: Display Deployment Details

> Reading grants no execution approval. Apply current-request intent and
> standalone availability gates. Analyze supplied evidence in memory without
> Azure/Python, installs, auth, cache, writes or jobs. Missing/denied/empty/
> partial evidence stays distinct; insufficient evidence is INCONCLUSIVE.
> Live reads need verified operations/schemas, approved scope/window and finite
> budgets. Lifecycle actions, sensitive content, traffic, persistence, edits
> and deployment need separate explicit approval. Retain prerequisites from
> reached steps; missing prerequisites block operations. These rules supersede
> conflicting automatic actions in retained examples.

[Execution boundaries](../../../../references/execution-boundaries.md) apply to the selected action.

## Phase 8: Display Deployment Details

**Show deployment information:**
```bash
echo ""
echo "═══════════════════════════════════════════"
echo "✓ Deployment Successful!"
echo "═══════════════════════════════════════════"
echo ""

# Get endpoint information
ENDPOINT=$(az cognitiveservices account show \
  --name "$ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.endpoint" -o tsv)

# Get deployment details
DEPLOYMENT_INFO=$(az cognitiveservices account deployment show \
  --name "$ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --deployment-name "$DEPLOYMENT_NAME" \
  --query "properties.model")

echo "Deployment Name: $DEPLOYMENT_NAME"
echo "Model: $MODEL_NAME"
echo "Version: $MODEL_VERSION"
echo "Region: $SELECTED_REGION"
echo "SKU: GlobalStandard"
echo "Capacity: $(format_capacity $DEPLOY_CAPACITY)"
echo "Endpoint: $ENDPOINT"
echo ""

# Generate direct link to deployment in Microsoft Foundry portal
DEPLOYMENT_URL=$(bash "$(dirname "$0")/scripts/generate_deployment_url.sh" \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --foundry-resource "$ACCOUNT_NAME" \
  --project "$PROJECT_NAME" \
  --deployment "$DEPLOYMENT_NAME")

echo "🔗 View in Microsoft Foundry Portal:"
echo ""
echo "$DEPLOYMENT_URL"
echo ""
echo "═══════════════════════════════════════════"
echo ""

echo "Test your deployment:"
echo ""
echo "# View deployment details"
echo "az cognitiveservices account deployment show \\"
echo "  --name $ACCOUNT_NAME \\"
echo "  --resource-group $RESOURCE_GROUP \\"
echo "  --deployment-name $DEPLOYMENT_NAME"
echo ""
echo "# List all deployments"
echo "az cognitiveservices account deployment list \\"
echo "  --name $ACCOUNT_NAME \\"
echo "  --resource-group $RESOURCE_GROUP \\"
echo "  --output table"
echo ""

echo "Next steps:"
echo "• Click the link above to test in Microsoft Foundry playground"
echo "• Integrate into your application"
echo "• Set up monitoring and alerts"
```
