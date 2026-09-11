# Multi-stage Dockerfiles

Choose the runtime used by the selected base guide.

| Runtime | Template | Default port |
|---|---|---:|
| Node.js/TypeScript | [node.md](node.md) | 3000 |
| Python | [python.md](python.md) | 8000 |
| .NET | [dotnet.md](dotnet.md) | 8080 |
| Java | [java.md](java.md) | 8080 |
| Go | [go.md](go.md) | 8080 |

Pin base images to an approved digest in production. Run as a non-root user, expose only
the application port, keep build tools out of the runtime stage, and add a `.dockerignore`.
