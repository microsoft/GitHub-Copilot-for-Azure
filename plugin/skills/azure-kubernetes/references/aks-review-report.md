# Report Generation Workflow

## Step 8: Generate Markdown Report

Use [AKS Audit Report Template](../assets/aks-audit-report-template.md) and fill all sections.

### Report Sections

1. Table of contents
2. Scope
3. Overview of AKS best practices
4. Detailed analysis table per pillar/checklist item
5. AKS Diagnostics Findings
6. Container Best Practices Assessment
7. Kubernetes Warning Events by Namespace
8. Summary
9. Next steps
10. Appendices

### Required Characteristics

- **Table of contents** with working anchors
- **Scope**: cluster identifier, extraction timestamps (UTC + local), Kubernetes version, region, node count with pool breakdown, out-of-scope, limitations
- **Detailed analysis**: all checklist items from both source pages
- **Summary**: 1-2 paragraphs
- **Next Steps** — time-boxed remediation roadmap:
  - **Immediate (0-2 weeks)**: Critical security/reliability with CLI commands
  - **Short-term (2-6 weeks)**: High-severity hardening (network policies, secrets migration, PSS)
  - **Medium-term (1-3 months)**: Operational maturity (probes, privileged containers, GitOps)
  - **Long-term (3-6 months)**: Strategic architecture (image digests, multi-region DR, chaos engineering)
- **Commands Reference**: Table of every major command category with exact syntax for reproducibility
- **Appendices**:
  - Full checklist table (Check ID, Parent/Child Page, Pillar, Item, Commands, Output)
  - Full diagnostics findings with raw evidence and exact commands/output
  - Full container best practices results with per-namespace breakdowns
  - Full Kubernetes Warning events with remediation
