/** Repository whose issues are surfaced from each skill page. */
export const ISSUES_REPO = "microsoft/GitHub-Copilot-for-Azure";

/**
 * Build a GitHub search URL for the open issues labelled with a skill's name.
 * The skill name is used verbatim as the label value.
 */
export function issuesUrl(skillName: string): string {
    const query = `is:issue state:open label:"${skillName}"`;
    return `https://github.com/${ISSUES_REPO}/issues?q=${encodeURIComponent(query)}`;
}
