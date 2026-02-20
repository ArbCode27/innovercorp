import { ExcelPayment } from "@/types/payments";
import * as XLSX from "xlsx";

export const validate = (file: File): ExcelPayment[] => {
  const workbook = XLSX.read(file, { type: "binary" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json<any>(sheet);

  console.log(rows);

  return rows.map((row) => ({
    monto: Number(row.Monto),
    fecha: new Date(row.Fecha),
    banco: row.Banco,
    referencia: String(row.Referencia),
    cedula: String(row.Cedula),
  }));
};
