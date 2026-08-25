# Microsoft Foundry 智能体验证

| 字段 | 值 |
|---|---|
| 报告 ID | `YYYYMMDDTHHMMSSZ` |
| 服务 | 服务名称 |
| 托管智能体根目录 | 托管智能体根目录 |
| 生成时间 | ISO 日期时间 |

## 规则结果

为每条启用的规则创建一个子节：

### `RULE-ID`：规则标题

- **级别：** error / warning / recommendation
- **状态：** pass / fail / inconclusive / skipped
- **最佳实践：** 将规则的 `bestPracticeLink` 呈现为 Markdown 链接。

#### 详情

说明结果；如可用，请引用已脱敏的 `file:line` 证据；对于失败说明如何修复，对于无法确定的结果说明缺少哪些证据。

当证据无法证明 `pass` 或 `fail` 时使用 `inconclusive`。

## 限制

这是基于存储库的自动化最佳实践审查，并非 Microsoft 认证、合规性证明、渗透测试或对已部署 Azure 环境的验证。
