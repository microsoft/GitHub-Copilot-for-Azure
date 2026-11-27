# Azure Developer CLI — Quick Reference

> Condensed from **azd-deployment**. Full patterns (Bicep modules,
> hooks, RBAC post-provision, service discovery, idempotent deploys)
> in the **azd-deployment** plugin skill if installed.

## Install
Prefer the package manager for your platform. See the [official azd installation guide](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd).

- **Windows:** `winget install microsoft.azd`
- **macOS:** `brew trust azure/azd && brew install --cask azure/azd/azd`
- **Linux:** Download the signed package for your distro and CPU architecture from [GitHub Releases](https://github.com/Azure/azure-dev/releases). Run the matching command from the download directory, replacing `azd.deb` or `azd.rpm` with the downloaded filename:
  - Debian/Ubuntu (`.deb`): `sudo apt install ./azd.deb`
  - Fedora/RHEL (`.rpm`): `sudo dnf install ./azd.rpm` (or `sudo yum install ./azd.rpm` on systems that use Yum)
  - Some distros use neither package format. Check the distro and its package manager first; if neither applies, consult the official guide rather than running either command.

**Script fallback (Linux/macOS only):** If no supported package-manager option is available, tell the user that the following command downloads and immediately executes a remote script. Run it only after the user explicitly confirms.

```bash
curl -fsSL https://aka.ms/install-azd.sh | bash
```

## Quick Start
```bash
azd auth login
azd init
azd up    # provision + build + deploy
```

## Best Practices
- Always use remoteBuild: true — local builds fail on ARM Macs deploying to AMD64
- Bicep outputs auto-populate .azure/<env>/.env — don't manually edit
- Use azd env set for secrets — not main.parameters.json defaults
- Service tags (azd-service-name) are required for azd to find Container Apps
- Use `|| true` in hooks — prevent RBAC "already exists" errors from failing deploy
