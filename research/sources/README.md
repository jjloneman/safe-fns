# 📚 Cached sources

Excerpts from tools that can't run in a container (Excel, Google Sheets, and
anything else docs-only), so a decision can cite them without fetching them
again each time.

- One file per tool, `<tool>.md`, opening with the source's URL, its version or
  commit, and the date it was fetched.
- Quote only the lines that settle a question, in a fenced block with a language
  specifier.
- Beside it, `<tool>.json` transcribes the outcomes the excerpt settles; the
  `sources` adapter turns it into columns marked docs-only in the generated
  tables, citing the `.md` in place of an image.
- Write a `.json` only once the excerpt settles at least one case; until then
  the `.md` stands alone.
- Prefer running the real tool whenever a container can.

```json
{
  "columns": [
    {
      "call": "VALUE(value)",
      "cases": [
        { "args": ["$1,000"], "outcome": { "kind": "value", "value": 1000 } }
      ],
      "function": "safeParseNumber",
      "locale": "en-US",
      "name": "Excel",
      "tier": 3,
      "version": "Microsoft 365"
    }
  ]
}
```

- Each case is matched to the case file by its `args`; a case the excerpt
  doesn't settle is `n/a`, and a settled case the case file no longer has fails
  the run, so a stale transcription can't go unnoticed.
