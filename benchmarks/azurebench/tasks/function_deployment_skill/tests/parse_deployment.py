"""parse_deployment.py - Evaluate deployment requirements."""
from parse_base import AzureEvaluationParser, run_evaluation


def evaluate(parser: AzureEvaluationParser):
    is_bestpractices_called = parser.is_tool_invoked("get_azure_bestpractices")
    is_azure_prepare_invoked = parser.is_skill_invoked("azure-prepare")
    is_azure_validate_invoked = parser.is_skill_invoked("azure-validate")
    is_azure_deploy_invoked = parser.is_skill_invoked("azure-deploy")

    is_azd_used_for_deployment = (
        parser.is_bash_command_executed("azd up") or
        parser.is_bash_command_executed("azd deploy")
    )

    azure_deployment_patterns = [
        r"https:\/\/[\w.-]+\.azurestaticapps\.net",
        r"https:\/\/[\w.-]+\.azurewebsites\.net\/api",
        r"https:\/\/[\w.-]+\.azurecontainerapps\.io",
        r"https:\/\/[\w.-]+\.azurewebsites\.net"
    ]
    is_deployment_successful = any(
        parser.is_regex_in_agent_message(pattern) for pattern in azure_deployment_patterns
    )

    resolved = is_deployment_successful

    return {
        "resolved": resolved,
        "metrics": {
            "is_bestpractices_called": is_bestpractices_called,
            "is_azure_prepare_invoked": is_azure_prepare_invoked,
            "is_azure_validate_invoked": is_azure_validate_invoked,
            "is_azure_deploy_invoked": is_azure_deploy_invoked,
            "is_azd_used_for_deployment": is_azd_used_for_deployment,
            "is_deployment_successful": is_deployment_successful
        }
    }


if __name__ == "__main__":
    run_evaluation(evaluate)
