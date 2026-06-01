# /// script
# dependencies = []
# ///
"""
transform_traces.py — Make a raw Foundry traces JSONL trainable by Azure FT.

The Foundry traces datagen passthrough export is NOT directly trainable.
Azure FT preprocessing rejects it with cryptic errors. This script applies five
deterministic fixes in order:

  1. Dedup overlapping snapshots
     Traces emits multiple snapshots per conversation as turns accumulate. Keep
     only the longest snapshot per conversation_id.

  2. Drop fragments
     Rows ending mid-tool-call (assistant emitted tool_calls but no subsequent
     tool reply) or with no final assistant turn.

  3. Strip content: "null"
     Some asst rows have content: "null" (the string, not the JSON null). Azure
     preprocessing crashes — replace with content: null (real JSON null) or "".

  4. Merge consecutive assistant tool_calls
     When the agent emitted N tool calls then a text turn, the export splits
     this into multiple assistant messages. Merge into one assistant message
     with all tool_calls + final content.

  5. Inject system + tools
     Trace export omits the system prompt and tool schema from each row. Both
     are needed at training time. Read from --system-prompt-file and
     --tools-file and prepend / attach to every row.

Usage:
  python transform_traces.py \
      --input traces_raw.jsonl --output traces_train.jsonl \
      --system-prompt-file agent_system_prompt.md \
      --tools-file agent_tools.json
"""

import json
import os
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser


def step1_dedup_overlapping(rows):
    """Keep only the longest snapshot per conversation_id."""
    by_conv = {}
    for row in rows:
        cid = row.get("conversation_id") or row.get("session_id") or id(row)
        msgs = row.get("messages", [])
        if cid not in by_conv or len(msgs) > len(by_conv[cid].get("messages", [])):
            by_conv[cid] = row
    return list(by_conv.values())


def step2_drop_fragments(rows):
    """Drop rows ending mid-tool-call or with no final assistant turn."""
    kept = []
    for row in rows:
        msgs = row.get("messages", [])
        if not msgs:
            continue
        last = msgs[-1]
        if last.get("role") == "assistant" and last.get("tool_calls"):
            kept.append(row)
            continue
        if last.get("role") == "assistant" and (last.get("content") or "").strip():
            kept.append(row)
            continue
    return kept


def step3_strip_null_strings(rows):
    """Replace content: "null" with content: null on asst tool_call rows."""
    for row in rows:
        for m in row.get("messages", []):
            if m.get("role") == "assistant" and m.get("tool_calls") and m.get("content") == "null":
                m["content"] = None
    return rows


def step4_merge_consecutive_asst(rows):
    """Merge consecutive assistant messages (e.g., tool_calls then a final text)."""
    for row in rows:
        msgs = row.get("messages", [])
        merged = []
        for m in msgs:
            if (merged
                and merged[-1].get("role") == "assistant"
                and m.get("role") == "assistant"
                and not _has_tool_reply_between(msgs, merged[-1], m)):
                prev = merged[-1]
                prev_tools = prev.get("tool_calls") or []
                new_tools = m.get("tool_calls") or []
                if prev_tools or new_tools:
                    prev["tool_calls"] = prev_tools + new_tools
                # Combine content (last non-empty wins; concatenate otherwise)
                p_content = prev.get("content") or ""
                n_content = m.get("content") or ""
                if p_content and n_content:
                    prev["content"] = p_content.rstrip() + "\n\n" + n_content
                elif n_content:
                    prev["content"] = n_content
                # leave as is otherwise
            else:
                merged.append(m)
        row["messages"] = merged
    return rows


def _has_tool_reply_between(msgs, prev, curr):
    """True if a 'tool' role message appears between prev and curr."""
    try:
        pi = msgs.index(prev)
        ci = msgs.index(curr)
    except ValueError:
        return False
    for m in msgs[pi + 1:ci]:
        if m.get("role") == "tool":
            return True
    return False


def step5_inject_system_and_tools(rows, system_prompt, tools):
    """Prepend system message + attach tools to every row."""
    out = []
    for row in rows:
        msgs = row.get("messages", [])
        # Replace or prepend system
        msgs = [m for m in msgs if m.get("role") != "system"]
        if system_prompt:
            msgs.insert(0, {"role": "system", "content": system_prompt})
        new_row = {"messages": msgs}
        if tools:
            new_row["tools"] = tools
        # Preserve a parallel_tool_calls hint if present
        if row.get("parallel_tool_calls") is not None:
            new_row["parallel_tool_calls"] = row["parallel_tool_calls"]
        out.append(new_row)
    return out


def main():
    parser = HelpOnErrorParser(description="Transform raw Foundry traces JSONL for Azure FT")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--system-prompt-file", help="Markdown or text file with the agent's system prompt")
    parser.add_argument("--tools-file", help="JSON file with the agent's tools array (OpenAI tools=[...] format)")
    args = parser.parse_args()

    rows = []
    with open(args.input, encoding="utf-8") as f:
        for i, line in enumerate(f):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"⚠️ Skipping malformed JSON on line {i+1}: {e}")
    print(f"Loaded {len(rows)} raw rows")

    rows = step1_dedup_overlapping(rows)
    print(f"  After step 1 (dedup overlapping snapshots): {len(rows)}")
    rows = step2_drop_fragments(rows)
    print(f"  After step 2 (drop fragments): {len(rows)}")
    rows = step3_strip_null_strings(rows)
    print(f"  After step 3 (strip 'null' content): {len(rows)}")
    rows = step4_merge_consecutive_asst(rows)
    print(f"  After step 4 (merge consecutive asst): {len(rows)}")

    system_prompt = ""
    if args.system_prompt_file:
        system_prompt = Path(args.system_prompt_file).read_text(encoding="utf-8").strip()
    tools = None
    if args.tools_file:
        with open(args.tools_file, encoding="utf-8") as f:
            tools = json.load(f)
        if isinstance(tools, dict) and "tools" in tools:
            tools = tools["tools"]
    rows = step5_inject_system_and_tools(rows, system_prompt, tools)
    print(f"  After step 5 (inject system+tools): {len(rows)}")

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"✅ Wrote {len(rows)} rows → {args.output}")
    print(f"   Validate with: python scripts/validate/validate_sft.py {args.output}")


if __name__ == "__main__":
    main()
