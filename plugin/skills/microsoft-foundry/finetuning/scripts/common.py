"""
common.py — Shared Azure AI Foundry authentication and client setup.

Supports three connection methods in order of preference:
1. /v1/ project endpoint (simplest, preferred)
2. Foundry SDK with DefaultAzureCredential (no API key needed, cloud-native)
3. Azure OpenAI endpoint (classic)

Usage:
    from common import get_clients, upload_file

    # Method 1: Project /v1/ endpoint (preferred)
    clients = get_clients(base_url="https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/",
                          api_key="KEY")

    # Method 2: Foundry SDK (DefaultAzureCredential — no API key needed)
    clients = get_clients(project_endpoint="https://<resource>.services.ai.azure.com/api/projects/<project>")

    # Method 3: Azure OpenAI endpoint
    clients = get_clients(azure_endpoint="https://<resource>.openai.azure.com",
                          api_key="KEY")
"""
import argparse
import os
import sys


class HelpOnErrorParser(argparse.ArgumentParser):
    """ArgumentParser that prints full help when arguments are invalid.
    
    Standard ArgumentParser only prints a one-line usage summary on error,
    which isn't helpful for first-time users. This prints the full --help.
    """

    def error(self, message):
        self.print_help(sys.stderr)
        self.exit(2, f"\nerror: {message}\n")


def get_clients(base_url=None, azure_endpoint=None, project_endpoint=None, api_key=None):
    """Initialize and return OpenAI-compatible client.

    Tries in order:
    1. Project /v1/ endpoint with openai.OpenAI() (simplest, preferred)
    2. Foundry SDK with AIProjectClient.get_openai_client() (no API key needed)
    3. Azure OpenAI endpoint with openai.AzureOpenAI() (classic)

    Returns: (openai_client, method_name)
    """
    # Method 1: /v1/ project endpoint
    base_url = base_url or os.environ.get("OPENAI_BASE_URL")
    api_key = api_key or os.environ.get("AZURE_OPENAI_API_KEY")

    if base_url:
        import openai
        # If no API key, try DefaultAzureCredential for token-based auth
        if not api_key:
            try:
                from azure.identity import DefaultAzureCredential
                credential = DefaultAzureCredential()
                token = credential.get_token("https://cognitiveservices.azure.com/.default")
                client = openai.OpenAI(base_url=base_url, api_key=token.token)
                print(f"✅ Connected via /v1/ project endpoint (DefaultAzureCredential)")
                return client, "project-v1-aad"
            except Exception as e:
                print(f"⚠️ No API key and DefaultAzureCredential failed: {e}")
                # Fall through to Method 2/3
        else:
            client = openai.OpenAI(base_url=base_url, api_key=api_key)
            print(f"✅ Connected via /v1/ project endpoint")
            return client, "project-v1"

    # Method 2: Foundry SDK
    project_endpoint = project_endpoint or os.environ.get("AZURE_AI_PROJECT_ENDPOINT")
    if project_endpoint:
        try:
            from azure.ai.projects import AIProjectClient
            from azure.identity import DefaultAzureCredential

            credential = DefaultAzureCredential()
            project_client = AIProjectClient(endpoint=project_endpoint, credential=credential)
            openai_client = project_client.get_openai_client()
            print(f"✅ Connected via Foundry SDK")
            return openai_client, "foundry-sdk"
        except Exception as e:
            print(f"⚠️ Foundry SDK failed: {e}")

    # Method 3: Azure OpenAI endpoint
    azure_endpoint = azure_endpoint or os.environ.get("AZURE_OPENAI_ENDPOINT")
    if azure_endpoint and api_key:
        import openai
        client = openai.AzureOpenAI(
            azure_endpoint=azure_endpoint,
            api_key=api_key,
            api_version="2025-04-01-preview",
        )
        print(f"✅ Connected via Azure OpenAI endpoint")
        return client, "azure-openai"

    print("❌ No valid connection method. Set one of:")
    print("   OPENAI_BASE_URL (preferred)")
    print("   AZURE_AI_PROJECT_ENDPOINT (Foundry SDK)")
    print("   AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY")
    sys.exit(1)
    return None, "none"  # unreachable, satisfies static analysis


def upload_file(openai_client, filepath: str, purpose: str = "fine-tune") -> str:
    """Upload a file to Azure AI Foundry and wait for processing."""
    print(f"📤 Uploading {filepath}...")
    with open(filepath, "rb") as f:
        file_obj = openai_client.files.create(file=f, purpose=purpose)
    print(f"   File ID: {file_obj.id}")
    print(f"   Waiting for processing...")
    openai_client.files.wait_for_processing(file_obj.id)
    print(f"   ✅ File ready")
    return file_obj.id
