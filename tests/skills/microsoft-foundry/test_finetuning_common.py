"""Fine-tuning authentication regressions using synthetic credentials and transports."""

from contextlib import contextmanager
import importlib
import importlib.util
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import Mock, patch

from azure.core.credentials import AccessToken
import openai
import requests


# OpenAI 3 uses httpx2; older SDKs use httpx.
httpx = importlib.import_module(
    "httpx2" if int(openai.__version__.split(".")[0]) >= 3 else "httpx"
)
SCRIPTS = (
    Path(__file__).resolve().parents[3]
    / "plugins" / "azure-skills" / "skills" / "microsoft-foundry"
    / "finetuning" / "scripts"
)


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


common = load_script("common")
with patch.dict(sys.modules, {"common": common}):
    submit_training = load_script("submit_training")

PROJECT = "https://unit-test.services.ai.azure.com/api/projects/unit-test"
BASE_URL = f"{PROJECT}/openai/v1/"
AZURE_ENDPOINT = "https://unit-test.openai.azure.com"
TOKEN = "synthetic-azure-token"
KEY = "synthetic-api-key"
MODES = (
    ({"base_url": BASE_URL}, "project-v1-aad"),
    ({"base_url": BASE_URL, "api_key": KEY}, "project-v1"),
    ({"project_endpoint": PROJECT}, "foundry-sdk"),
    ({"azure_endpoint": AZURE_ENDPOINT}, "azure-openai-aad"),
    ({"azure_endpoint": AZURE_ENDPOINT, "api_key": KEY}, "azure-openai"),
)


class SyntheticCredential:
    def get_token(self, *scopes, **kwargs):
        return AccessToken(TOKEN, int(time.time()) + 3600)


class FineTuningAuthenticationTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, {}, clear=True)
        environment.start()
        self.addCleanup(environment.stop)
        self.provider = Mock(return_value=TOKEN)
        provider_factory = patch.object(
            common, "_make_token_provider", return_value=self.provider,
        )
        self.provider_factory = provider_factory.start()
        self.addCleanup(provider_factory.stop)
        credential_factory = patch(
            "azure.identity.DefaultAzureCredential",
            return_value=SyntheticCredential(),
        )
        self.credential_factory = credential_factory.start()
        self.addCleanup(credential_factory.stop)

    @contextmanager
    def client(self, options, handler=None):
        received = []

        def respond(request):
            received.append(request)
            if handler:
                return handler(request)
            return httpx.Response(200, json={"object": "list", "data": []})

        client_type = openai.DefaultHttpxClient
        transport = httpx.MockTransport(respond)

        def make_http_client(**kwargs):
            return client_type(transport=transport, **kwargs)

        with patch.object(openai, "DefaultHttpxClient", side_effect=make_http_client):
            client, method = common.get_clients(**options)
            client.max_retries = 0
            try:
                yield client, method, received
            finally:
                client.close()

    def test_rejects_untrusted_or_ambiguous_urls_before_credentials(self):
        for endpoint in (
            "http://unit-test.services.ai.azure.com/",
            "https://example.invalid/",
            "https://unit-test.services.ai.azure.com.example.invalid/",
            "https://unit-test-services.ai.azure.com/",
            "https://127.0.0.1/",
            "https://unit-test.openai.azure.com:8443/",
            "https://unit-test.openai.azure.com:0/",
            "https://user:password@unit-test.openai.azure.com/",
            "https://@unit-test.openai.azure.com/",
            "https://unit-test.openai.azure.com\\@example.invalid/",
            "https://unit-test.openai.azure.com/?api-key=example",
            "https://unit-test.openai.azure.com/?",
            "https://unit-test.openai.azure.com/#fragment",
            "https://unit-test.openai.azure.com/#",
            "https://unit-test.openai.azure.com:\n443/",
            "https://unit-test.openai.azure.com:invalid/",
            "https://unit-test.openai.azure.com./",
        ):
            with self.subTest(endpoint=endpoint):
                with self.assertRaises(common._EndpointValidationError):
                    common.get_clients(base_url=endpoint)
        self.provider_factory.assert_not_called()
        self.credential_factory.assert_not_called()

    def test_validates_all_argument_and_environment_endpoints_for_both_auth_modes(self):
        for argument, variable in (
            ("base_url", "OPENAI_BASE_URL"),
            ("project_endpoint", "AZURE_AI_PROJECT_ENDPOINT"),
            ("azure_endpoint", "AZURE_OPENAI_ENDPOINT"),
        ):
            for from_environment in (False, True):
                for api_key in (None, KEY):
                    with self.subTest(
                        argument=argument, environment=from_environment, api_key=bool(api_key),
                    ):
                        options = {"base_url": BASE_URL, "azure_endpoint": AZURE_ENDPOINT}
                        environment = {}
                        if from_environment:
                            options.pop(argument, None)
                            environment[variable] = "https://example.invalid/"
                            if api_key:
                                environment["AZURE_OPENAI_API_KEY"] = api_key
                        else:
                            options[argument] = "https://example.invalid/"
                            options["api_key"] = api_key
                        with patch.dict(os.environ, environment, clear=True):
                            with self.assertRaises(common._EndpointValidationError):
                                common.get_clients(**options)
        self.provider_factory.assert_not_called()
        self.credential_factory.assert_not_called()

    def test_preserves_valid_connection_modes_and_query_parameters(self):
        for options, expected_method in MODES:
            with self.subTest(method=expected_method):
                with self.client(options) as (client, method, received):
                    client.models.list()
                    self.assertEqual(method, expected_method)
                    self.assertEqual(len(received), 1)
                    request = received[0]
                    if expected_method == "azure-openai":
                        self.assertEqual(request.headers["api-key"], KEY)
                    else:
                        expected_token = KEY if expected_method == "project-v1" else TOKEN
                        self.assertEqual(
                            request.headers["Authorization"], f"Bearer {expected_token}",
                        )
                    if expected_method.startswith("azure-openai"):
                        self.assertEqual(request.url.params["api-version"], "2025-04-01-preview")

    def test_accepts_canonical_case_and_explicit_https_port(self):
        options = {
            "base_url": "HTTPS://UNIT-TEST.SERVICES.AI.AZURE.COM:443/openai/v1/",
            "api_key": KEY,
        }
        with self.client(options) as (client, _, received):
            client.models.list()
            self.assertEqual(received[0].url.host, "unit-test.services.ai.azure.com")

    def test_refreshes_aad_authorization_for_each_valid_request(self):
        self.provider.side_effect = ("verification-token", "first-token", "second-token")
        with self.client({"base_url": BASE_URL}) as (client, _, received):
            client.models.list()
            client.models.list()
            self.assertEqual(
                [request.headers["Authorization"] for request in received],
                ["Bearer first-token", "Bearer second-token"],
            )
            self.assertEqual(self.provider.call_count, 3)

    def test_blocks_absolute_url_overrides_even_to_another_azure_resource(self):
        for options, method in MODES:
            with self.client(options) as (client, _, received):
                for target in (
                    "https://example.invalid/models",
                    "https://another.openai.azure.com/openai/v1/models",
                    "http://unit-test.services.ai.azure.com/models",
                    f"https://{client.base_url.host}:0/models",
                ):
                    with self.subTest(method=method, target=target):
                        with self.assertRaises(
                            (openai.APIConnectionError, common._EndpointValidationError),
                        ) as error:
                            client.get(target, cast_to=dict)
                        validation_error = error.exception
                        if isinstance(validation_error, openai.APIConnectionError):
                            validation_error = validation_error.__cause__
                        self.assertIsInstance(validation_error, common._EndpointValidationError)
                        self.assertEqual(received, [])

    def test_does_not_follow_redirects_with_credentials(self):
        def redirect(request):
            return httpx.Response(
                307, headers={"Location": "https://example.invalid/models"},
            )

        for options, method in MODES:
            with self.subTest(method=method):
                with self.client(options, redirect) as (client, _, received):
                    with self.assertRaises(openai.APIStatusError):
                        client.models.list()
                    self.assertEqual(len(received), 1)
                    self.assertNotEqual(received[0].url.host, "example.invalid")

    def test_rejects_sdk_origin_changes_without_falling_back(self):
        unexpected_client = Mock(base_url="https://another.openai.azure.com/openai/v1/")
        with patch(
            "azure.ai.projects.AIProjectClient.get_openai_client",
            return_value=unexpected_client,
        ), patch.object(openai, "DefaultHttpxClient"):
            with self.assertRaises(common._EndpointValidationError):
                common.get_clients(project_endpoint=PROJECT, azure_endpoint=AZURE_ENDPOINT)
        unexpected_client.close.assert_called_once()
        self.provider_factory.assert_not_called()

    def test_rest_submission_rejects_untrusted_endpoints_before_sending(self):
        with patch.object(submit_training.requests, "post") as post:
            for endpoint in ("https://example.invalid/", AZURE_ENDPOINT + "?", AZURE_ENDPOINT + "#"):
                with self.subTest(endpoint=endpoint):
                    with self.assertRaises(common._EndpointValidationError):
                        submit_training.submit_sft_rest(
                            endpoint, KEY, "model", "file-test", None,
                        )
            post.assert_not_called()

    def test_rest_submission_does_not_forward_api_key_on_redirect(self):
        received = []

        class RedirectTransport(requests.adapters.BaseAdapter):
            def send(self, request, **kwargs):
                received.append(request)
                response = requests.Response()
                response.url = request.url
                response.request = request
                response._content = b'{"id":"job-test","status":"queued"}'
                if len(received) == 1:
                    response.status_code = 307
                    response.headers["Location"] = "https://example.invalid/collect"
                else:
                    response.status_code = 201
                return response

            def close(self):
                pass

        with requests.Session() as session:
            session.mount("https://", RedirectTransport())
            with patch.object(submit_training.requests, "post", side_effect=session.post):
                with self.assertRaisesRegex(RuntimeError, "REST submission failed \\(307\\)"):
                    submit_training.submit_sft_rest(
                        AZURE_ENDPOINT, KEY, "model", "file-test", None,
                    )
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0].headers["api-key"], KEY)


if __name__ == "__main__":
    unittest.main()
