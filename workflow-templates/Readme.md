# Workflow templates

`workflow-templates/` contains reusable workflow templates that can be used to compose workflows outside the microsoft/GitHub-Copilot-for-Azure repo.

## Skill evaluation

This workflow template can be used to run vally evaluation suites for skills hosted in the microsoft/azure-skills repo. The vally evaluation suites supported by this workflow follows the same standard of the evaluation suites in microsoft/github-copilot-for-azure repo.

### Example use cases

microsoft/github-copilot-for-azure hosts evaluation suites of skills. However, you may want to create separate workflows to run evaluation suites.

Example cases include:

1. Run evaluation suites where the agent has access to a separate test Azure subscription.
2. Run evaluation suites and publish the test results to a customized location for additional processing.
3. Run evaluation that requires special dependencies

### Files

This workflow template provides both the Azure DevOps flavor and the GitHub Actions flavor.

- azure-devops/evaluation-main.yaml
- github/evaluation-main.yaml

The `evaluation-main.yaml` templates are complete workflow definitions that can be used out-of-box to create a new pipeline. It imports the composite actions template `evaluation-steps/actions.yml` from microsoft/github-copilot-for-azure repo to run the evaluation suites and upload test results.

For quick start, create a new pipeline using `evaluation-main.yaml` as is and complete the mandatory user setup steps. Learn more about the optional customization options of the templates if needed.

### User setup

Here are the mandatory setup steps for the user to use this template

1. Create a GitHub connection

This is only required for Azure DevOps flavor.

- Create a GitHub connection in Azure DevOps. Azure DevOps require a GitHub connection even though all the repositories referenced by the templates are public.
- Replace the `endpoint` value with the connection name (default placeholder value `github-service-connection`)

2. Create an Azure connection

For GitHub flavor:
- Create a managed identity in the test Azure subscription.
- Create a Federated Identity Credential in the managed identity with information of the GitHub repo hosting the workflow.
- Add the AZURE_CLIENT_ID (client id of the managed identity), AZURE_TENANT_ID (tenant of the test subscription), AZURE_SUBSCRIPTION_ID (test subscription) environment variables to the new workflow.

For Azure DevOps flavor:
- Create an Azure Connection to connect to the test Azure subscription.

3. Grant Copilot access

For GitHub flavor:

- Make sure the GitHub repo hosting the workflow has access to Copilot API. The workflow templates sets `copilot-requests: write` to try using the pipeline token to access Copilot. Users can alternatively set a secret environment variable COPILOT_GITHUB_TOKEN with a PAT that grants access to Copilot.

For Azure DevOps flavor:
- Generate a PAT that grants Copilot access and set it as a secret environment variable COPILOT_GITHUB_TOKEN.

4. Create the eval suites

By default, the templates look for eval suites to run in `evals/{plugin}/{skill}` of the pipeline's hosting repo. The eval suites follows the same standard as the evaluation suites in the microsoft/github-copilot-for-azure repo.

5. Test run the workflow

The first time an Azure Pipeline attempt to use a connection, the web UI prompts for granting permission. Do a test run of the pipeline and grant the permission.
