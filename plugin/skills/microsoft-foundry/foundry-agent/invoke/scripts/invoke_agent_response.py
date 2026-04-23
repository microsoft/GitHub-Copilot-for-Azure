import argparse

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import VersionRefIndicator
from azure.identity import DefaultAzureCredential


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-endpoint", required=True)
    parser.add_argument("--agent-name", required=True)
    parser.add_argument("--input-text", required=True)
    parser.add_argument("--isolation-key", default="fallback-isolation-key")
    return parser.parse_args()


def main():
    args = parse_args()

    with (
        DefaultAzureCredential() as credential,
        AIProjectClient(
            endpoint=args.project_endpoint,
            credential=credential,
            allow_preview=True,
        ) as project_client,
    ):
        agent = project_client.agents.get(agent_name=args.agent_name)
        latest_version = agent.versions["latest"].version

        session = project_client.beta.agents.create_session(
            agent_name=args.agent_name,
            isolation_key=args.isolation_key,
            version_indicator=VersionRefIndicator(agent_version=latest_version),
        )

        try:
            openai_client = project_client.get_openai_client(agent_name=args.agent_name)

            response = openai_client.responses.create(
                input=args.input_text,
                extra_body={
                    "agent_session_id": session.agent_session_id,
                },
            )
            print(response.output_text)
        finally:
            project_client.beta.agents.delete_session(
                agent_name=args.agent_name,
                session_id=session.agent_session_id,
                isolation_key=args.isolation_key,
            )


if __name__ == "__main__":
    main()
