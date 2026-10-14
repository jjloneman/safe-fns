# 📚 Cached sources

Excerpts from tools that can't run in a container (Excel, Google Sheets, and anything else docs-only), so a decision can cite them without fetching them again each time.

- One file per tool, `<tool>.md`, opening with the source's URL, its version or commit, and the date it was fetched.
- Quote only the lines that settle a question, in a fenced block with a language specifier.
- A column built from a cached source is marked docs-only in the generated tables; prefer running the real tool whenever a container can.
