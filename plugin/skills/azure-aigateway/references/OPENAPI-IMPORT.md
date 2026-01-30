# Import API from OpenAPI Specification

## Import from Web URL

```bash
az apim api import -g <apim-rg> --service-name <apim> --api-id <api-id> --path <api-path> \
  --display-name "<API Name>" --specification-format OpenApiJson --specification-url "https://example.com/openapi.json"
```

## Import from Local File

```bash
az apim api import -g <apim-rg> --service-name <apim> --api-id <api-id> --path <api-path> \
  --display-name "<API Name>" --specification-format OpenApi --specification-path "./openapi.yaml"
```

## Configure Backend

```bash
az apim backend create -g <apim-rg> --service-name <apim> --backend-id <backend-id> --protocol http --url "https://your-api.com"
az apim api update -g <apim-rg> --service-name <apim> --api-id <api-id> --set properties.serviceUrl="https://your-api.com"
```

## Apply Policies (Optional)

```xml
<inbound>
    <set-backend-service backend-id="{backend-id}" />
    <rate-limit-by-key calls="100" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
</inbound>
```

## Supported Formats

| Format | Value | Extension |
|--------|-------|-----------|
| OpenAPI 3.x JSON | `OpenApiJson` | `.json` |
| OpenAPI 3.x YAML | `OpenApi` | `.yaml` |
| Swagger 2.0 JSON | `SwaggerJson` | `.json` |
| WSDL | `Wsdl` | `.wsdl` |
