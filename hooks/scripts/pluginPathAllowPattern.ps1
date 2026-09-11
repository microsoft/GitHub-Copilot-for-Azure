$pluginPathPatterns = @()

# --- azure-skills plugin ---
# The Copilot CLI pattern wildcards the catalog/marketplace folder name
# (e.g. "awesome-copilot") since it does not necessarily match the plugin's
# own name ("azure").
$pathPatternCopilot = '\.copilot/installed-plugins/[^/]+/azure/skills/'
$pathPatternClaude = '\.claude/plugins/cache/(azure-skills|claude-plugins-official)/azure/[0-9.]+/skills/'
$pathPatternCursor = '\.cursor/plugins/cache/[^/]+/azure/[^/]+/skills/'
$pathPatternVscodeAgentPlugins = 'agent-plugins/github\.com/microsoft/azure-skills/\.github/plugins/azure-skills/skills/'

# --- azure-kusto-graph-skills plugin ---
$pathPatternCopilotKustoGraph = '\.copilot/installed-plugins/[^/]+/azure-kusto-graph-skills/skills/'
$pathPatternClaudeKustoGraph = '\.claude/plugins/cache/azure-skills/azure-kusto-graph-skills/[0-9.]+/skills/'
$pathPatternCursorKustoGraph = '\.cursor/plugins/cache/[^/]+/azure-kusto-graph-skills/[^/]+/skills/'
$pathPatternVscodeAgentPluginsKustoGraph = 'agent-plugins/github\.com/microsoft/azure-skills/\.github/plugins/azure-kusto-graph-skills/skills/'

$pluginPathPatterns += @(
	$pathPatternCopilot,
	$pathPatternClaude,
	$pathPatternCursor,
	$pathPatternVscodeAgentPlugins,
	$pathPatternCopilotKustoGraph,
	$pathPatternClaudeKustoGraph,
	$pathPatternCursorKustoGraph,
	$pathPatternVscodeAgentPluginsKustoGraph
)
