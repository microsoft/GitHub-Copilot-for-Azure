# Microsoft Foundry Troubleshooting

## Deployment Issues

### Problem: Deployment Stays Pending or Fails

```bash
az cognitiveservices account deployment show -n <resource> -g <rg> --deployment-name <name> -o json
az cognitiveservices account show -n <resource> -g <rg> --query "properties.quotaLimit"
```

**Causes:** Insufficient quota, region at capacity, permission issues

**Resolution:** Check quota in Portal, request increase, try different region, verify RBAC

---

## Agent Response Issues

### Problem: Agent Doesn't Return Citations (RAG)

**Check:** Agent instructions request citations, tool choice is "required" or "auto", AI Search configured

**Resolution:** Update instructions to request citations in format `[message_idx:search_idx†source]`

### Problem: "Index Not Found" Error

**Using MCP Tools:**

Use the `foundry_knowledge_index_list` MCP tool to verify the index exists and get the correct name.

**Resolution:**
1. Verify `AI_SEARCH_INDEX_NAME` environment variable matches actual index name
2. Check the connection points to correct Azure AI Search resource
3. Ensure index has been created and populated

### Problem: 401/403 Authentication Errors

**Common Cause:** Missing RBAC permissions

**Resolution:**

```bash
# Assign Search Index Data Contributor role to managed identity
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Search Index Data Contributor" \
  --scope /subscriptions/<subscription-id>/resourceGroups/<rg>/providers/Microsoft.Search/searchServices/<search-service>

# Verify role assignment
az role assignment list \
  --assignee <managed-identity-principal-id> \
  --output table
```

---

## Evaluation Issues

### Problem: Evaluation Dashboard Shows No Data

**Common Causes:**
- No recent agent traffic
- Time range excludes the data
- Ingestion delay

**Resolution:**
1. Generate new agent traffic (test queries)
2. Expand the time range filter in the dashboard
3. Wait a few minutes for data ingestion
4. Refresh the dashboard

### Problem: Continuous Evaluation Not Running

**Diagnostics:**

Check evaluation run status to identify issues. For SDK implementation, see [python.md](python.md#checking-evaluation-status).

**Resolution:**
1. Verify the evaluation rule is enabled
2. Confirm agent traffic is flowing
3. Check project managed identity has **Azure AI User** role
4. Verify OpenAI endpoint and deployment are accessible

---

## Rate Limiting and Capacity Issues

### Problem: Agent Run Fails with Rate Limit Error

**Error Message:** `Rate limit is exceeded` or HTTP 429

**Resolution:**

```bash
# Check current quota usage
az cognitiveservices usage list \
  --name <resource-name> \
  --resource-group <resource-group>

# Request quota increase (manual process in portal)
echo "Request quota increase in Azure Portal under Quotas section"
```

**Best Practices:**
- Implement exponential backoff retry logic
- Use Dynamic Quota when available
- Monitor quota usage proactively
- Consider multiple deployments across regions
