# Google Sheets

- **Source:** [VALUE](https://support.google.com/docs/answer/3094220), Google
  Docs Editors Help
- **Version:** Google Sheets as of the fetch date (the page carries no revision
  date)
- **Fetched:** 2026-10-14

## `VALUE(text)`

```text
Converts a string in any of the date, time or number formats that Google Sheets understands into a number.
When strings can't be converted, the function will display an error.
=VALUE("01/01/2012")  →  40909
```

- The page's sample formulas (`VALUE("123")`, `VALUE("12:00:00")`) give no
  results, so it settles none of the current cases; there is no
  `google-sheets.json` until a case it does settle exists.
