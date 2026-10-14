# Excel

- **Source:**
  [VALUE function](https://support.microsoft.com/en-us/office/value-function-257d0108-07dc-437d-ae1c-bc2d3953d8c2),
  Microsoft Support
- **Version:** Excel for Microsoft 365 (the page lists Excel 2016 through 365;
  it carries no revision date)
- **Fetched:** 2026-10-14

## `VALUE(text)`

```text
Text can be in any of the constant number, date, or time formats recognized by Microsoft Excel.
If text is not in one of these formats, VALUE returns the #VALUE! error value.
=VALUE("$1,000")  →  1000
```

- The formats Excel "recognizes" follow the workbook's locale, and the page
  lists them nowhere, so it settles none of the current cases; there is no
  `excel.json` until a case it does settle (such as `"$1,000"`) exists.
