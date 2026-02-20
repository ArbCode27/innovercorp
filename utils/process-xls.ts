import { PaymentBank } from "@/types/payments";
import * as XLSX from "xlsx";

export const processBanplusFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const json = XLSX.utils.sheet_to_json(worksheet, {
          defval: null,
          raw: false,
        });

        resolve(json);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject("Error leyendo el archivo");

    reader.readAsArrayBuffer(file);
  });
};

const parseNumber = (value: any): number => {
  if (!value) return 0;
  return Number(String(value).replace(".", "").replace(",", "."));
};

export const processBancamigaFile = (file: File): Promise<PaymentBank[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return reject("Archivo inválido");

        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Convertimos todo a array de filas
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
        });

        // Buscar la fila donde empieza la tabla (la que contiene "Nro.")
        const startIndex = rows.findIndex((row) => row[0] === "Nro.");

        if (startIndex === -1) {
          return reject("No se encontró la tabla de movimientos");
        }

        const movimientos: PaymentBank[] = [];

        for (let i = startIndex + 1; i < rows.length; i++) {
          const row = rows[i];

          // Cuando llega a totales, se corta
          if (
            typeof row[0] === "string" &&
            row[0].toLowerCase().includes("creditos")
          ) {
            break;
          }

          if (!row[0]) continue;

          movimientos.push({
            Referencia: String(row[2]),
          });
        }

        resolve(movimientos);
      } catch (error) {
        reject(error);
      }
    };

    reader.readAsArrayBuffer(file);
  });
};
