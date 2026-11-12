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

/**
 * A report instead of one table: sections, each a heading with a line under it and then a table without
 * headers. A row of one cell (an open answer) runs the full width; a row of three is label, count, share.
 */
export type ExportSection = { heading: string; meta?: string; rows: ExportCell[][] };
export type ExportReport = { title: string; subtitle?: string; sections: ExportSection[] };

const isReport = (table: ExportTable | ExportReport): table is ExportReport => "sections" in table;

/** Letters, digits and dashes from the title. */
export function exportName(title: string, extension: "xlsx" | "pdf"): string {
  const base = title.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${base || "results"}.${extension}`;
}

const BORDER = "#c8c4d2";

async function reportXlsx(report: ExportReport): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const edge = { borderColor: BORDER, borderStyle: "thin" as const };
  const data: unknown[][] = [[{ value: report.title, fontWeight: "bold", fontSize: 16, columnSpan: 3, wrap: true }, null, null]];
  if (report.subtitle) data.push([{ value: report.subtitle, columnSpan: 3, wrap: true, color: "#6e6e6e" }, null, null]);
  for (const section of report.sections) {
    data.push([]);
    data.push([{ value: section.heading, fontWeight: "bold", fontSize: 12, columnSpan: 3, wrap: true, backgroundColor: "#ebe8f2" }, null, null]);
    if (section.meta) data.push([{ value: section.meta, columnSpan: 3, color: "#6e6e6e" }, null, null]);
    for (const row of section.rows) {
      data.push(
        row.length === 1
          ? [{ value: row[0], columnSpan: 3, wrap: true, alignVertical: "top" as const, ...edge }, null, null]
          : row.map((value, i) => ({ value, wrap: true, alignVertical: "top" as const, align: i === 0 ? ("left" as const) : ("right" as const), ...edge })),
      );
    }
  }
  const columns = [{ width: 70 }, { width: 12 }, { width: 12 }];
  await writeXlsxFile(data as never, { columns, sheet: report.title.slice(0, 31) || "Sheet1" }).toFile(exportName(report.title, "xlsx"));
}

export async function downloadXlsx(table: ExportTable | ExportReport): Promise<void> {
  if (isReport(table)) return reportXlsx(table);
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

async function newPdf(orientation: "landscape" | "portrait") {
  const [{ jsPDF }, regular, bold] = await Promise.all([
    import("jspdf"),
    fontBase64("/fonts/DejaVuSans.ttf"),
    fontBase64("/fonts/DejaVuSans-Bold.ttf"),
  ]);
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  return doc;
}

/** Portrait A4: the title, then per section its heading, a grey line and a table without headers. */
async function reportPdf(report: ExportReport): Promise<void> {
  const doc = await newPdf("portrait");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usable = pageWidth - MARGIN * 2;
  const widths = [usable * 0.7, usable * 0.15, usable * 0.15];
  let y = MARGIN;

  const lines = (text: string, size: number, bold: boolean, width: number) => {
    doc.setFont("DejaVu", bold ? "bold" : "normal");
    doc.setFontSize(size);
    return doc.splitTextToSize(text, width) as string[];
  };
  const room = (height: number) => {
    if (y + height <= pageHeight - MARGIN) return;
    doc.addPage();
    y = MARGIN;
  };

  const title = lines(report.title, 16, true, usable);
  doc.text(title, MARGIN, y + 14);
  y += title.length * 20;
  if (report.subtitle) {
    const sub = lines(report.subtitle, 9, false, usable);
    doc.setTextColor(110, 110, 110);
    doc.text(sub, MARGIN, y + 8);
    doc.setTextColor(0, 0, 0);
    y += sub.length * LINE + 4;
  }
  y += 10;

  for (const section of report.sections) {
    const heading = lines(section.heading, 11, true, usable - 12);
    const meta = section.meta ? lines(section.meta, 8, false, usable - 12) : [];
    const first = section.rows[0] ?? [];
    const firstHeight = (first.length === 1 ? lines(String(first[0]), 9, false, usable - CELL_PAD * 2).length : 1) * LINE + CELL_PAD * 2;
    const headHeight = heading.length * 15 + meta.length * 11 + 10;
    // The heading never stays alone at the bottom of a page.
    room(headHeight + firstHeight);
    doc.setFillColor(235, 232, 242);
    doc.rect(MARGIN, y, usable, headHeight, "F");
    lines(section.heading, 11, true, usable - 12);
    doc.text(heading, MARGIN + 6, y + 14);
    if (meta.length > 0) {
      lines(section.meta ?? "", 8, false, usable - 12);
      doc.setTextColor(110, 110, 110);
      doc.text(meta, MARGIN + 6, y + 14 + (heading.length - 1) * 15 + 12);
      doc.setTextColor(0, 0, 0);
    }
    y += headHeight;

    for (const row of section.rows) {
      const span = row.length === 1;
      const cells = span ? [usable] : widths;
      const wrapped = row.map((cell, i) => lines(String(cell ?? ""), 9, false, cells[i]! - CELL_PAD * 2));
      const height = Math.max(1, ...wrapped.map((l) => l.length)) * LINE + CELL_PAD * 2;
      room(height);
      let x = MARGIN;
      wrapped.forEach((cellLines, i) => {
        doc.setDrawColor(200, 196, 210);
        doc.rect(x, y, cells[i]!, height);
        doc.setFont("DejaVu", "normal");
        doc.setFontSize(9);
        cellLines.forEach((text, n) => {
          const right = i > 0;
          doc.text(text, right ? x + cells[i]! - CELL_PAD : x + CELL_PAD, y + CELL_PAD + LINE * (n + 1) - 3, right ? { align: "right" } : undefined);
        });
        x += cells[i]!;
      });
      y += height;
    }
    y += 14;
  }
  doc.save(exportName(report.title, "pdf"));
}

/** A landscape A4 table with the Kyrgyz and Russian letters (DejaVu Sans, shipped in /fonts). */
export async function downloadPdf(table: ExportTable | ExportReport): Promise<void> {
  if (isReport(table)) return reportPdf(table);
  const doc = await newPdf("landscape");

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
