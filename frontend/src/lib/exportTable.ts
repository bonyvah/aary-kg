/**
 * Results as a file: an .xlsx sheet or a .pdf table. Built in the browser from what the screen shows,
 * so the headers are in the screen's language. The libraries load only when a file is asked for.
 */

export type ExportCell = string | number;

export type ExportTable = {
  title: string;
  /** Under the title: a date, the groups... */
  subtitle?: string;
  headers: string[];
  rows: ExportCell[][];
};

/** Letters, digits and dashes from the title. */
export function exportName(title: string, extension: "xlsx" | "pdf"): string {
  const base = title.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${base || "results"}.${extension}`;
}

export async function downloadXlsx(table: ExportTable): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = table.headers.map((value) => ({ value, fontWeight: "bold" as const }));
  const rows = table.rows.map((row) => row.map((value) => ({ value })));
  const lead = [[{ value: table.title, fontWeight: "bold" as const }], ...(table.subtitle ? [[{ value: table.subtitle }]] : []), []];
  const widths = table.headers.map((h, i) => Math.min(60, Math.max(h.length, ...table.rows.map((r) => String(r[i] ?? "").length)) + 2));
  await writeXlsxFile([...lead, header, ...rows], { columns: widths.map((width) => ({ width })), sheet: table.title.slice(0, 31) || "Sheet1" }).toFile(
    exportName(table.title, "xlsx"),
  );
}

async function fontBase64(path: string): Promise<string> {
  const bytes = new Uint8Array(await (await fetch(path)).arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const MARGIN = 36;
const LINE = 13;
const CELL_PAD = 4;

/** A landscape A4 table with the Kyrgyz and Russian letters (DejaVu Sans, shipped in /fonts). */
export async function downloadPdf(table: ExportTable): Promise<void> {
  const [{ jsPDF }, regular, bold] = await Promise.all([
    import("jspdf"),
    fontBase64("/fonts/DejaVuSans.ttf"),
    fontBase64("/fonts/DejaVuSans-Bold.ttf"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usable = pageWidth - MARGIN * 2;
  // Columns share the width by how long their texts are, each at least a little.
  const lengths = table.headers.map((h, i) => Math.max(4, Math.min(40, Math.max(h.length, ...table.rows.map((r) => String(r[i] ?? "").length)))));
  const total = lengths.reduce((a, b) => a + b, 0);
  const widths = lengths.map((n) => (n / total) * usable);

  let y = MARGIN;
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(16);
  for (const line of doc.splitTextToSize(table.title, usable) as string[]) {
    doc.text(line, MARGIN, y + 12);
    y += 20;
  }
  if (table.subtitle) {
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(10);
    doc.text(table.subtitle, MARGIN, y + 8);
    y += 18;
  }
  y += 6;

  const drawRow = (cells: ExportCell[], header: boolean) => {
    doc.setFont("DejaVu", header ? "bold" : "normal");
    doc.setFontSize(9);
    const lines = cells.map((cell, i) => doc.splitTextToSize(String(cell ?? ""), widths[i]! - CELL_PAD * 2) as string[]);
    const height = Math.max(1, ...lines.map((l) => l.length)) * LINE + CELL_PAD * 2;
    if (y + height > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
      if (!header) drawRow(table.headers, true);
      doc.setFont("DejaVu", header ? "bold" : "normal");
      doc.setFontSize(9);
    }
    let x = MARGIN;
    lines.forEach((cellLines, i) => {
      if (header) {
        doc.setFillColor(235, 232, 242);
        doc.rect(x, y, widths[i]!, height, "F");
      }
      doc.setDrawColor(200, 196, 210);
      doc.rect(x, y, widths[i]!, height);
      cellLines.forEach((text, n) => doc.text(text, x + CELL_PAD, y + CELL_PAD + LINE * (n + 1) - 3));
      x += widths[i]!;
    });
    y += height;
  };

  drawRow(table.headers, true);
  for (const row of table.rows) drawRow(row, false);
  doc.save(exportName(table.title, "pdf"));
}
