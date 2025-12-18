import * as XLSX from "xlsx";

export function exportExcel(rows, fileName = "export.xlsx") {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("exportExcel: No data to export");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  XLSX.writeFile(workbook, fileName);
}
