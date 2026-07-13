function escapeCsvField(field: string): string {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** Builds a CSV file from `rows` and triggers a browser download of it. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((row) => row.map((cell) => escapeCsvField(String(cell))).join(","))
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
