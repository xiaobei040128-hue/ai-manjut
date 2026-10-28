/** Quote spreadsheet cells and neutralize formulas in user-provided text. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (typeof value !== "number" && /^[\s\u0000-\u001f]*[=+@-]/u.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function createCsv(rows: unknown[][]): string {
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
