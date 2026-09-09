#!/usr/bin/env bash
#
# Walks the agent through the azure-prepare workflow, one step at a time.
#
# Exit codes:
#   0 = success
#   1 = workflow check failed
#   2 = usage or argument error
#
# Usage:
#   ./workflow.sh --workspace-path <path> [--completed-step <step>]

set -euo pipefail

usage() {
    sed -n '/^# Usage:/,/^$/p' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
}

workspace_path=""
completed_step=""

while [ "$#" -gt 0 ]; do
    case "$1" in
        --workspace-path)
            if [ "$#" -lt 2 ] || [ -z "$2" ]; then
                echo "Error: --workspace-path requires a value." >&2
                exit 2
            fi
            workspace_path=$2
            shift 2
            ;;
        --completed-step)
            if [ "$#" -lt 2 ] || [ -z "$2" ]; then
                echo "Error: --completed-step requires a value." >&2
                exit 2
            fi
            completed_step=$2
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            echo "Error: unknown option '$1'." >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [ -z "$workspace_path" ]; then
    echo "Error: --workspace-path is required." >&2
    exit 2
fi

if [ ! -d "$workspace_path" ]; then
    echo "Error: workspace path '$workspace_path' does not exist or is not a directory." >&2
    exit 2
fi

normalize_step() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

step=$(normalize_step "${completed_step:-None}")
valid_steps="none createplanskeleton specializedtechnologycheck analyzeworkspace gatherrequirements scancodebase selectrecipe planarchitecture finalizeplan approveplan researchcomponents confirmazurecontext generateartifacts hardensecurity functionalverification updatestatus"

case " $valid_steps " in
    *" $step "*) ;;
    *)
        echo "Error: '--completed-step $completed_step' is not a valid step." >&2
        exit 2
        ;;
esac

azure_dir="$workspace_path/.azure"
mkdir -p "$azure_dir"
printf '{\n  "completedStep": "%s"\n}\n' "${completed_step:-None}" > "$azure_dir/prepare-status.json"

emit_action() {
    printf 'Action: %s\n' "$1"
    if [ -n "${2:-}" ]; then
        printf 'Next: re-run workflow.sh with --completed-step %s after completing the action.\n' "$2"
    fi
    if [ -n "${3:-}" ]; then
        printf 'Reference: %s\n' "$3"
    fi
}

case "$step" in
    none)
        emit_action 'Create the initial `.azure/deployment-plan.md` skeleton in the workspace root before generating code, infrastructure, or configuration.' "CreatePlanSkeleton" "SKILL.md, references/plan-template.md"
        ;;
    createplanskeleton)
        emit_action "Check the prompt and workspace for specialized technologies. Invoke a matching specialized skill first when required." "SpecializedTechnologyCheck" "references/specialized-routing.md"
        ;;
    specializedtechnologycheck)
        emit_action "Analyze the workspace and determine whether the mode is NEW, MODIFY, or MODERNIZE." "AnalyzeWorkspace" "references/analyze.md"
        ;;
    analyzeworkspace)
        emit_action "Gather the workload classification, scale, and budget requirements." "GatherRequirements" "references/requirements.md"
        ;;
    gatherrequirements)
        emit_action "Scan the codebase to identify components, technologies, and dependencies." "ScanCodebase" "references/scan.md"
        ;;
    scancodebase)
        emit_action "Select the appropriate AZD, AZCLI, Bicep, or Terraform recipe." "SelectRecipe" "references/recipe-selection.md"
        ;;
    selectrecipe)
        emit_action "Select the application stack and map each component to Azure services." "PlanArchitecture" "references/architecture.md"
        ;;
    planarchitecture)
        emit_action 'Finalize `.azure/deployment-plan.md` with all decisions from the planning phase.' "FinalizePlan" "references/plan-template.md"
        ;;
    finalizeplan)
        emit_action "Present the completed deployment plan and get explicit user approval before executing it. If the user requests changes, revise and present the plan again." "ApprovePlan" '`.azure/deployment-plan.md`'
        ;;
    approveplan)
        emit_action "Research the approved components by loading service references and invoking related skills." "ResearchComponents" "references/research.md"
        ;;
    researchcomponents)
        emit_action "Detect and confirm the Azure subscription and location with the user, then check the resource provisioning limit." "ConfirmAzureContext" "references/azure-context.md"
        ;;
    confirmazurecontext)
        emit_action "Generate the approved infrastructure and configuration artifacts." "GenerateArtifacts" "references/generate.md"
        ;;
    generateartifacts)
        emit_action "Apply the required security best practices to the generated artifacts." "HardenSecurity" "references/security.md"
        ;;
    hardensecurity)
        emit_action "Verify that the application UI and backend work locally, when possible." "FunctionalVerification" "references/functional-verification.md"
        ;;
    functionalverification)
        emit_action 'Update the status in `.azure/deployment-plan.md` to `Ready for Validation`.' "UpdateStatus" '`.azure/deployment-plan.md`'
        ;;
    updatestatus)
        emit_action "The azure-prepare workflow is complete. Invoke azure-validate. Do not run deployment commands directly." "" ""
        ;;
esac
