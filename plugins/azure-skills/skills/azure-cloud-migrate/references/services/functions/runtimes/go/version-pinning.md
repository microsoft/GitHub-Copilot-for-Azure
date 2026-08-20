# Pinning the Golang Worker Module Version

The worker module is preview-only, and its tagged `vX.Y.Z-preview` releases often lag active development on `main`. Never hand-author the `require` line — always let the Go toolchain resolve and write it.

## Enumerate available versions first

```bash
go list -m -versions github.com/azure/azure-functions-golang-worker
```

Or check the [Releases page](https://github.com/Azure/azure-functions-golang-worker/releases). Inspect the latest tag's date against activity on `main`.

## Pick a pin strategy

| Situation | Command |
| --- | --- |
| Latest preview tag looks recent | `go get github.com/azure/azure-functions-golang-worker@v0.6.0-preview` (substitute current tag) |
| Latest tag looks stale relative to `main` | `go get github.com/azure/azure-functions-golang-worker@main` (resolves to a pseudo-version like `v0.6.1-0.20260721153000-abcdef123456`) |
| Reproducing a known-good commit | `go get github.com/azure/azure-functions-golang-worker@<commit-sha>` |

## Never do this

Do **not** author `require github.com/azure/azure-functions-golang-worker v0.0.0` (or any unresolved version) by hand. `go mod tidy` fails with:

```
reading github.com/azure/azure-functions-golang-worker/go.mod at revision v0.0.0: unknown revision v0.0.0
```

The same rule applies to every sub-package import (`.../sdk`, `.../worker`, `.../triggers/blob`, `.../sdk/bindings`, etc.) — they share the parent module's version, so **do not add separate `require` lines for them**. One `go get` on the root module pins them all.
