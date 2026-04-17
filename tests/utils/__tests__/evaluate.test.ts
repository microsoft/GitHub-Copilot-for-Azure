/**
 * Tests for evaluate utility — specifically the stripNonExecutableContent function
 * which filters out heredoc bodies, comments, and other non-command content
 * before shell command pattern matching.
 */

import { stripNonExecutableContent } from "../evaluate";

describe("stripNonExecutableContent", () => {
  test("passes through simple commands unchanged", () => {
    expect(stripNonExecutableContent("azd up")).toBe("azd up");
    expect(stripNonExecutableContent("azd deploy --all")).toBe("azd deploy --all");
    expect(stripNonExecutableContent("mkdir -p src && npm install")).toBe("mkdir -p src && npm install");
  });

  test("strips single-quoted heredoc body", () => {
    const command = `cat > README.md << 'EOF'
# My App
Run: azd up
Deploy: azd deploy
EOF
echo done`;
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd up");
    expect(result).not.toContain("azd deploy");
    expect(result).toContain("echo done");
    expect(result).toContain("cat > README.md ");
  });

  test("strips double-quoted heredoc body", () => {
    const command = `cat > file.txt << "MARKER"
azd up --no-prompt
MARKER`;
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd up");
  });

  test("strips unquoted heredoc body", () => {
    const command = `cat > file.txt << EOF
azd deploy
EOF`;
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd deploy");
  });

  test("strips heredoc with dash (<<-) for tab stripping", () => {
    const command = `cat > file.txt <<-END
\tazd up
\tEND`;
    // Note: <<- strips leading tabs from content AND delimiter
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd up");
  });

  test("handles delimiter with hyphens", () => {
    const command = `cat > file.txt << 'END-MARK'
azd up
END-MARK`;
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd up");
  });

  test("preserves commands after heredoc ends", () => {
    const command = `cat > README.md << 'EOF'
azd up
EOF
azd provision --preview`;
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd up");
    expect(result).toContain("azd provision --preview");
  });

  test("handles multiple heredocs in sequence", () => {
    const command = `cat > file1.txt << 'EOF1'
azd up
EOF1
cat > file2.txt << 'EOF2'
azd deploy
EOF2
azd provision`;
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd up");
    expect(result).not.toContain("azd deploy");
    expect(result).toContain("azd provision");
  });

  test("strips shell comment lines", () => {
    const command = `# This runs azd up to deploy
azd provision --preview`;
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd up");
    expect(result).toContain("azd provision --preview");
  });

  test("preserves shebangs", () => {
    const command = `#!/bin/bash
azd provision`;
    const result = stripNonExecutableContent(command);
    expect(result).toContain("#!/bin/bash");
    expect(result).toContain("azd provision");
  });

  test("handles the exact failing scenario from issue 1930", () => {
    // This is the actual command that caused the false positive
    const command = `cat > /tmp/skill-test-Fjv9Xq/README.md << 'EOF'
# Containerized Web Application

## Deployment to Azure

### First Time Setup

1. Login to Azure:
\`\`\`bash
azd auth login
\`\`\`

2. Provision infrastructure and deploy:
\`\`\`bash
azd up
\`\`\`

### Subsequent Deployments

To deploy code changes:
\`\`\`bash
azd deploy
\`\`\`
EOF`;
    const result = stripNonExecutableContent(command);
    expect(result).not.toContain("azd up");
    expect(result).not.toContain("azd deploy");
    // The cat > file part before the heredoc is preserved
    expect(result).toContain("cat > /tmp/skill-test-Fjv9Xq/README.md ");
  });
});
