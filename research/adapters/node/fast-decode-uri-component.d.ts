/** fast-decode-uri-component, which ships untyped; one tool module imports it. */
declare module "fast-decode-uri-component" {
  /**
   * Decode a URI component, as `decodeURIComponent` does.
   *
   * @returns the decoded text, or `null` for a malformed escape.
   */
  export default function fastDecode(text: string): null | string;
}
