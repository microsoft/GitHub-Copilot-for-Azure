# Normalize Linux scripts

Before every deployment/redeployment, explicitly select shipped `.sh` files, text executables with a shebang (e.g. `bin/www`), and referenced startup scripts. Exclude binaries and `node_modules`. From the application root, replace the example path below with the selected files; skip only if none exist.

For Python projects, the example below works in Bash and PowerShell. For other stacks, use an available byte-preserving tool to perform the same conversion and verification without requiring Python. Stop before packaging if normalization fails.

```bash
python -c "import sys; from pathlib import Path
for name in sys.argv[1:]:
    p = Path(name)
    data = p.read_bytes()
    if b'\0' in data: raise ValueError(p)
    lf = data.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
    if lf != data: p.write_bytes(lf)
    if b'\r' in p.read_bytes(): raise ValueError(p)
" "./startup.sh"
```

In the same shell call, check the result before packaging:

```bash
if [ "$?" -ne 0 ]; then exit 1; fi
```

```powershell
if (-not $? -or $LASTEXITCODE -ne 0) { throw "LF normalization/validation failed" }
```
