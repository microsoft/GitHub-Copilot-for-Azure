import argparse
import json

import requests
from azure.identity import DefaultAzureCredential


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-endpoint", required=True)
    parser.add_argument("--agent-name", required=True)
    parser.add_argument("--input-payload-json", required=True)
    parser.add_argument("--api-version", default="2025-05-15-preview")
    return parser.parse_args()


def main():
    args = parse_args()
    payload = json.loads(args.input_payload_json)

    if not isinstance(payload, dict):
        raise ValueError("--input-payload-json must be a JSON object.")

    credential = DefaultAzureCredential()
    token = credential.get_token("https://ai.azure.com/.default").token

    url = f"{args.project_endpoint}/agents/{args.agent_name}/endpoint/protocols/invocations"

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        params={"api-version": args.api_version},
        json=payload,
        stream=True,
    )
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "")
    if "text/event-stream" in content_type:
        for line in response.iter_lines(decode_unicode=True):
            if line:
                print(line)
        return

    print(response.json())


if __name__ == "__main__":
    main()
