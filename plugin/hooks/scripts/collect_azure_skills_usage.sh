#!/bin/bash

INPUT=$(cat)

# Save the raw hook JSON input
echo "$INPUT" > hook_json_input.json

# Extract session ID from hook input
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId')

# Build path to session events file
EVENTS_PATH="$HOME/.copilot/session-state/$SESSION_ID/events.jsonl"

# Generate timestamp for output filename
TIMESTAMP=$(date +%Y%m%d%H%M%S)
OUTPUT_FILE="copilot-session-id-${TIMESTAMP}.txt"

# Skill name allow list (from microsoft/azure-skills)
ALLOWED_SKILLS=(
  "airunway-aks-setup"
  "appinsights-instrumentation"
  "azure-ai"
  "azure-aigateway"
  "azure-cloud-migrate"
  "azure-compliance"
  "azure-compute"
  "azure-cost"
  "azure-deploy"
  "azure-diagnostics"
  "azure-enterprise-infra-planner"
  "azure-hosted-copilot-sdk"
  "azure-kubernetes"
  "azure-kusto"
  "azure-messaging"
  "azure-prepare"
  "azure-quotas"
  "azure-rbac"
  "azure-resource-lookup"
  "azure-resource-visualizer"
  "azure-storage"
  "azure-upgrade"
  "azure-validate"
  "entra-agent-id"
  "entra-app-registration"
  "microsoft-foundry"
)

ALLOWED_TOOLS=(
  "azure-subscription_list"
  "azure-resource_group_list"
)

# Extract skills invoked in this session, filtered by allow list
if [ -f "$EVENTS_PATH" ]; then
  # Check if azure-deploy skill was invoked; exit early if not
  AZURE_DEPLOY_INVOKED=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "skill" and .data.arguments.skill == "azure-deploy") |
     .data.toolCallId' \
    "$EVENTS_PATH" | head -1)
  if [ -z "$AZURE_DEPLOY_INVOKED" ]; then
    exit 0
  fi

  # Get model: use last model_change if any, otherwise selectedModel from session.start
  MODEL=$(jq -r 'select(.type == "session.model_change") | .data.newModel' "$EVENTS_PATH" | tail -1)
  if [ -z "$MODEL" ]; then
    MODEL=$(jq -r 'select(.type == "session.start") | .data.selectedModel // empty' "$EVENTS_PATH" | head -1)
  fi

  ALLOW_PATTERN=$(printf '%s\n' "${ALLOWED_SKILLS[@]}" | jq -R . | jq -s .)
  SKILLS=$(jq -r --argjson allowed "$ALLOW_PATTERN" \
    'select(.type == "tool.execution_start" and .data.toolName == "skill") |
     .data.arguments.skill |
     select(. as $s | $allowed | index($s))' \
    "$EVENTS_PATH")

  # Check which allowed tools were called and if they succeeded
  TOOL_RESULTS=""
  for TOOL_NAME in "${ALLOWED_TOOLS[@]}"; do
    # Remove trailing comma from array element if present
    TOOL_NAME=$(echo "$TOOL_NAME" | tr -d ',')

    TOOL_CALL_IDS=$(jq -r \
      "select(.type == \"tool.execution_start\" and .data.toolName == \"$TOOL_NAME\") |
       .data.toolCallId" \
      "$EVENTS_PATH")

    if [ -n "$TOOL_CALL_IDS" ]; then
      TOOL_CALL_COUNT=$(echo "$TOOL_CALL_IDS" | wc -l | tr -d ' ')
      # Check if any call succeeded
      TOOL_CALL_IDS_JSON=$(echo "$TOOL_CALL_IDS" | jq -R . | jq -s .)
      TOOL_SUCCESS_COUNT=$(jq -r --argjson ids "$TOOL_CALL_IDS_JSON" \
        'select(.type == "tool.execution_complete") |
         select(.data.toolCallId as $id | $ids | index($id)) |
         select(.data.success == true) |
         .data.toolCallId' \
        "$EVENTS_PATH" | wc -l | tr -d ' ')
      TOOL_RESULTS="${TOOL_RESULTS}  ${TOOL_NAME}: called=${TOOL_CALL_COUNT}, succeeded=${TOOL_SUCCESS_COUNT}\n"
    fi
  done

  # Check for azd up/deploy tool calls and their success status
  AZD_CALL_IDS=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "bash") |
     select(.data.arguments.command | test("azd (up|deploy)")) |
     .data.toolCallId' \
    "$EVENTS_PATH")

  AZD_DEPLOYMENT_CALL_COUNT=0
  AZD_DEPLOYMENT_RESULTS=""
  if [ -n "$AZD_CALL_IDS" ]; then
    AZD_DEPLOYMENT_CALL_COUNT=$(echo "$AZD_CALL_IDS" | wc -l | tr -d ' ')

    INSTANCE=0
    for CALL_ID in $AZD_CALL_IDS; do
      INSTANCE=$((INSTANCE + 1))

      # Get the command that was invoked (azd up or azd deploy)
      FULL_COMMAND=$(jq -r \
        "select(.type == \"tool.execution_start\" and .data.toolCallId == \"$CALL_ID\") |
         .data.arguments.command" \
        "$EVENTS_PATH" | head -1)
      if echo "$FULL_COMMAND" | grep -q "azd up"; then
        AZD_COMMAND="azd up"
      else
        AZD_COMMAND="azd deploy"
      fi

      # Check if the tool call itself was successful
      TOOL_SUCCESS=$(jq -r \
        "select(.type == \"tool.execution_complete\" and .data.toolCallId == \"$CALL_ID\") |
         .data.success" \
        "$EVENTS_PATH" | head -1)

      # Check if the result content contains error/fail strings
      RESULT_CONTENT=$(jq -r \
        "select(.type == \"tool.execution_complete\" and .data.toolCallId == \"$CALL_ID\") |
         .data.result.content // empty" \
        "$EVENTS_PATH")

      if [ "$TOOL_SUCCESS" = "true" ] && ! echo "$RESULT_CONTENT" | grep -qiE "error|fail"; then
        INSTANCE_STATUS="success"
      else
        INSTANCE_STATUS="failed"
      fi

      # Check for a deployment link in this call's result
      LINK=$(echo "$RESULT_CONTENT" | grep -oE "https?://[^ ]*(azurecontainerapps\.io|azurewebsites\.net|cloudapp\.azure\.com|azure-api\.net|azurecr\.io|azure\.com)[^ ]*" | head -1)
      DEPLOYMENT_LINK_FOUND="false"
      if [ -n "$LINK" ]; then
        DEPLOYMENT_LINK_FOUND="true"
      fi

      AZD_DEPLOYMENT_RESULTS="${AZD_DEPLOYMENT_RESULTS}  ${INSTANCE}: ${INSTANCE_STATUS} | deployment_link_found=${DEPLOYMENT_LINK_FOUND} | ${AZD_COMMAND}\n"
    done
  fi

  # Check if any create tool calls created bicep or terraform files
  BICEP_FILES_CREATED=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "create") |
     .data.arguments.path |
     select(test("\\.(bicep|bicepparam)$"))' \
    "$EVENTS_PATH")

  TERRAFORM_FILES_CREATED=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "create") |
     .data.arguments.path |
     select(test("\\.(tf|tfvars)$"))' \
    "$EVENTS_PATH")

  # Check if any edit tool calls edited bicep or terraform files
  BICEP_FILES_EDITED=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "edit") |
     .data.arguments.path |
     select(test("\\.(bicep|bicepparam)$"))' \
    "$EVENTS_PATH")

  TERRAFORM_FILES_EDITED=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "edit") |
     .data.arguments.path |
     select(test("\\.(tf|tfvars)$"))' \
    "$EVENTS_PATH")

  BICEP_CREATED_COUNT=0
  if [ -n "$BICEP_FILES_CREATED" ]; then
    BICEP_CREATED_COUNT=$(echo "$BICEP_FILES_CREATED" | wc -l | tr -d ' ')
  fi

  BICEP_EDITED_COUNT=0
  if [ -n "$BICEP_FILES_EDITED" ]; then
    BICEP_EDITED_COUNT=$(echo "$BICEP_FILES_EDITED" | wc -l | tr -d ' ')
  fi

  TERRAFORM_CREATED_COUNT=0
  if [ -n "$TERRAFORM_FILES_CREATED" ]; then
    TERRAFORM_CREATED_COUNT=$(echo "$TERRAFORM_FILES_CREATED" | wc -l | tr -d ' ')
  fi

  TERRAFORM_EDITED_COUNT=0
  if [ -n "$TERRAFORM_FILES_EDITED" ]; then
    TERRAFORM_EDITED_COUNT=$(echo "$TERRAFORM_FILES_EDITED" | wc -l | tr -d ' ')
  fi

  # Check for azure.yaml file creation and edits
  AZURE_YAML_CREATED=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "create") |
     .data.arguments.path |
     select(test("azure\\.yaml$"))' \
    "$EVENTS_PATH" | head -1)

  AZURE_YAML_EDITED=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "edit") |
     .data.arguments.path |
     select(test("azure\\.yaml$"))' \
    "$EVENTS_PATH" | head -1)

  AZURE_YAML_CREATED_FLAG="false"
  if [ -n "$AZURE_YAML_CREATED" ]; then
    AZURE_YAML_CREATED_FLAG="true"
  fi

  AZURE_YAML_EDITED_FLAG="false"
  if [ -n "$AZURE_YAML_EDITED" ]; then
    AZURE_YAML_EDITED_FLAG="true"
  fi

  # Check for build failures (bash commands matching common build patterns that failed)
  BUILD_CALL_IDS=$(jq -r \
    'select(.type == "tool.execution_start" and .data.toolName == "bash") |
     select(.data.arguments.command | test("(npm run build|dotnet build|mvn |gradle |make |go build|cargo build|tsc |webpack|vite build|azd build)")) |
     .data.toolCallId' \
    "$EVENTS_PATH")

  BUILD_CALL_COUNT=0
  BUILD_FAILURE_COUNT=0
  if [ -n "$BUILD_CALL_IDS" ]; then
    BUILD_CALL_COUNT=$(echo "$BUILD_CALL_IDS" | wc -l | tr -d ' ')
    BUILD_CALL_IDS_JSON=$(echo "$BUILD_CALL_IDS" | jq -R . | jq -s .)
    BUILD_FAILURE_COUNT=$(jq -r --argjson ids "$BUILD_CALL_IDS_JSON" \
      'select(.type == "tool.execution_complete") |
       select(.data.toolCallId as $id | $ids | index($id)) |
       select(.data.success == false) |
       .data.toolCallId' \
      "$EVENTS_PATH" | wc -l | tr -d ' ')
  fi

  # Write session ID, model, deployment status, tools, and skills to output file
  {
    echo "session_id: $SESSION_ID"
    echo "model: $MODEL"
    echo "azd_deployment_call_count: $AZD_DEPLOYMENT_CALL_COUNT"
    echo "azd_deployment_results:"
    printf "$AZD_DEPLOYMENT_RESULTS"
    echo "bicep_created_count: $BICEP_CREATED_COUNT"
    echo "bicep_edited_count: $BICEP_EDITED_COUNT"
    echo "terraform_created_count: $TERRAFORM_CREATED_COUNT"
    echo "terraform_edited_count: $TERRAFORM_EDITED_COUNT"
    echo "azure_yaml_created: $AZURE_YAML_CREATED_FLAG"
    echo "azure_yaml_edited: $AZURE_YAML_EDITED_FLAG"
    echo "build_call_count: $BUILD_CALL_COUNT"
    echo "build_failure_count: $BUILD_FAILURE_COUNT"
    echo "tools:"
    printf "$TOOL_RESULTS"
    echo "skills:"
    echo "$SKILLS"
  } > "$OUTPUT_FILE"
else
  echo "Events file not found: $EVENTS_PATH" > "$OUTPUT_FILE"
fi
