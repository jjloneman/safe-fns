/** The Markdown body every built record ends with. */
const RECORD_BODY = "\n# Title\n\nBody text.\n";

/**
 * Build an OKF record from its frontmatter lines and a stub body.
 *
 * @param frontmatter - the lines between the two `---` fences.
 * @returns the whole record text.
 */
export function buildRecord(frontmatter: readonly string[]): string {
  return `---\n${frontmatter.join("\n")}\n---\n${RECORD_BODY}`;
}
