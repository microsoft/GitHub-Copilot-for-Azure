# Process content for retrieval

**Domain:** Knowledge
**Reads:** workload profile — corpus and content type, query shape.

Choose how source documents become retrievable text. Run this before ingestion,
because the extraction path determines what retrieval can ever return: content
lost at extraction cannot be recovered by tuning the retrieval algorithm.

Read `references/architecture-choices.md` first. Minimal extraction is the
default; this primitive exists to decide when it is not enough.

## 1. Inspect the corpus and the questions

Sample the corpus rather than trusting file extensions. Establish:

- The dominant content type: clean text, or PDFs, presentations, manuals, and
  scanned material heavy in diagrams, figures, images, tables, or complex layout.
- Whether the expected questions depend on that non-text content. "Which
  connector feeds the control module, based on this wiring diagram?" depends on
  it; "what is the warranty period?" usually does not.
- Whether the user wants that material represented and retrievable, or only the
  surrounding prose.

## 2. Select the mode

| Mode | Select when | Cost |
|---|---|---|
| Minimal extraction | The information the questions need survives as text | Lowest latency and price; the default |
| Content Understanding Standard | Images, diagrams, tables, or layout carry information the questions need, and the user wants it retrievable | Higher processing time and price per document |

Standard Mode structures multimodal content and supports RAG and Search
workflows, preserving text plus image context instead of flattening a diagram to
a caption. Do not select it because the corpus merely contains an image, and do
not reject it merely because it costs more when the questions clearly depend on
figures or tables.

When the choice is genuinely ambiguous, treat it as an evaluable variable rather
than a guess: compose `evaluation/measure-quality` over a sample and compare the
two paths on the queries that motivated the request.

Remote SharePoint retrieval is textual and cannot apply Standard Mode. When
multimodal fidelity matters for SharePoint content, that is a reason to prefer
the indexed path in `knowledge/connect-sharepoint`.

## 3. Configure and verify

Apply the selected mode to the knowledge source or skillset, keeping the
definition source-controlled and the API version pinned. Preserve the original
file path or document identity as the citation target regardless of mode.

Verify the mode actually took effect. A silent fallback to basic text extraction
is the failure this primitive prevents, and it is invisible in document counts:

1. Processed documents report the selected mode, not a default.
2. A document known to carry a diagram or table produces structured output for
   it, not just surrounding prose.
3. A query that depends on that non-text content returns the passage that
   contains it.
4. Failed or partially processed documents are reported, not silently dropped.

When ingestion succeeds but the multimodal check fails, compose
`troubleshooting/diagnose-and-repair`. Do not compensate by raising reasoning effort
or enabling answer synthesis; those hide a content-processing defect behind model
behavior.

## Output contract

Return the corpus sample and content-type evidence, the selected mode and the
questions that justify it, the alternative considered, the applied configuration,
the verification that the mode took effect, per-document failures, and the cost
and latency implication of the choice.
