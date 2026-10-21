# Launch the local Speech SDK log analyzer.
# Exit codes: 0 = analysis written to stdout or --help, 1 = file/read/size error, 2 = usage/argument error.
& node (Join-Path $PSScriptRoot 'analyze-speech-sdk-log.mjs') @args
if ($null -ne $LASTEXITCODE) {
    exit $LASTEXITCODE
}
exit 1
