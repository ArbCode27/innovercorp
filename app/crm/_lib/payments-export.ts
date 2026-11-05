import {
  formatPaymentAmount,
  formatPaymentDateTime,
  getPaymentApprovedAt,
  normalizeReceptorBank,
  CRM_PAYMENT_STATUS_LABELS,
  type CrmPayment,
} from "./payments";
import { roundMoney } from "./payment-amount-compare";

export interface PaymentsExportOptions {
  payments: CrmPayment[];
  selectedBanks: string[];
  dateRange: { from?: string; to?: string };
  generatedAt?: Date;
  statusFilter?: string;
}

const escapeXml = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9_-]/g, "_");

/**
 * Builds a clear, descriptive filename for the exported spreadsheet.
 * e.g., pagos_bancamiga_2026-11-01_a_2026-11-02.xls
 */
export const buildExportFileName = (
  selectedBanks: string[],
  dateRange: { from?: string; to?: string },
  extension: "xls" | "csv" = "xls",
): string => {
  let bankPart = "todos_los_bancos";
  if (selectedBanks.length === 1 && selectedBanks[0] && selectedBanks[0] !== "all") {
    bankPart = sanitizeFileName(selectedBanks[0].toLowerCase());
  } else if (selectedBanks.length > 1 && !selectedBanks.includes("all")) {
    bankPart = `${selectedBanks.length}_bancos`;
  }

  const from = dateRange.from || "inicio";
  const to = dateRange.to || "hoy";
  return `pagos_${bankPart}_${from}_a_${to}.${extension}`;
};

interface BankGroup {
  bankName: string;
  payments: CrmPayment[];
  totalAmount: number;
  approvedCount: number;
  approvedAmount: number;
  inProcessCount: number;
  inProcessAmount: number;
}

export const groupPaymentsByBank = (payments: CrmPayment[]): BankGroup[] => {
  const groupsMap = new Map<string, BankGroup>();

  for (const payment of payments) {
    const rawBank = payment.bank;
    const bankName = normalizeReceptorBank(rawBank) || rawBank || "Sin banco receptor";

    let group = groupsMap.get(bankName);
    if (!group) {
      group = {
        bankName,
        payments: [],
        totalAmount: 0,
        approvedCount: 0,
        approvedAmount: 0,
        inProcessCount: 0,
        inProcessAmount: 0,
      };
      groupsMap.set(bankName, group);
    }

    group.payments.push(payment);
    const amount = Number(payment.amount);
    const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    group.totalAmount = roundMoney(group.totalAmount + validAmount);

    if (payment.status === "APROBADO") {
      group.approvedCount += 1;
      group.approvedAmount = roundMoney(group.approvedAmount + validAmount);
    } else if (payment.status === "EN_PROCESO" || payment.status === "RECIBIDO") {
      group.inProcessCount += 1;
      group.inProcessAmount = roundMoney(group.inProcessAmount + validAmount);
    }
  }

  return Array.from(groupsMap.values()).sort((a, b) =>
    a.bankName.localeCompare(b.bankName),
  );
};

/**
 * Generates an official Microsoft XML Spreadsheet 2003 (.xls).
 * Opens cleanly in Microsoft Excel, LibreOffice, and Google Sheets
 * with colors, fonts, freeze panes, aligned cells, and currency formulas.
 */
export const generatePaymentsExcelXml = (options: PaymentsExportOptions): string => {
  const {
    payments,
    selectedBanks,
    dateRange,
    generatedAt = new Date(),
    statusFilter,
  } = options;

  const bankGroups = groupPaymentsByBank(payments);
  const totalPayments = payments.length;
  const grandTotalAmount = roundMoney(
    payments.reduce((acc, p) => acc + (Number(p.amount) > 0 ? Number(p.amount) : 0), 0),
  );

  const formattedDate = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(generatedAt);

  const bankLabel =
    selectedBanks.length === 0 || selectedBanks.includes("all")
      ? "Todos los bancos receptores"
      : selectedBanks.join(", ");

  const rangeLabel =
    dateRange.from && dateRange.to
      ? `${dateRange.from} al ${dateRange.to}`
      : dateRange.from
        ? `Desde ${dateRange.from}`
        : "Histórico completo";

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Innover Corp CRM</Author>
  <Company>Innover Corp</Company>
  <Created>${generatedAt.toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#0F172A"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#475569"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaValue">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SectionHeader">
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
   </Borders>
  </Style>
  <Style ss:ID="BankGroupHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0369A1"/>
   <Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BAE6FD"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BAE6FD"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BAE6FD"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BAE6FD"/>
   </Borders>
  </Style>
  <Style ss:ID="CellDefault">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCurrency">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <NumberFormat ss:Format="&quot;$&quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellStatusApproved">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellStatusPending">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#9A3412"/>
   <Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FED7AA"/>
   </Borders>
  </Style>
  <Style ss:ID="BankSubtotalRow">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="BankSubtotalCurrency">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0369A1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;$&quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="GrandTotalRow">
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#FEF08A" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#CA8A04"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#854D0E"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CA8A04"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CA8A04"/>
   </Borders>
  </Style>
  <Style ss:ID="GrandTotalCurrency">
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#854D0E"/>
   <Interior ss:Color="#FEF08A" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;$&quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#CA8A04"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#854D0E"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CA8A04"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CA8A04"/>
   </Borders>
  </Style>
 </Styles>

 <Worksheet ss:Name="Pagos Recibidos">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="45"/>
   <Column ss:Width="85"/>
   <Column ss:Width="140"/>
   <Column ss:Width="95"/>
   <Column ss:Width="190"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Column ss:Width="125"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>

   <!-- Encabezado corporativo -->
   <Row ss:Height="26">
    <Cell ss:MergeAcross="10" ss:StyleID="Title"><Data ss:Type="String">INNOVER CORP · REPORTE DE PAGOS RECIBIDOS</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Período:</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(rangeLabel)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Fecha de emisión:</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(formattedDate)}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Bancos:</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(bankLabel)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Total movimientos:</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="MetaValue"><Data ss:Type="String">${totalPayments} pagos registrados (${escapeXml(formatPaymentAmount(grandTotalAmount))})</Data></Cell>
   </Row>
   ${
     statusFilter && statusFilter !== "all"
       ? `<Row ss:Height="18">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Filtro Estado:</Data></Cell>
    <Cell ss:MergeAcross="9" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(statusFilter)}</Data></Cell>
   </Row>`
       : ""
   }
   <Row ss:Height="10"><Cell ss:MergeAcross="10"/></Row>

   <!-- RESUMEN EJECUTIVO POR BANCO -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="10" ss:StyleID="SectionHeader"><Data ss:Type="String">  RESUMEN EJECUTIVO POR BANCO RECEPTOR</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="1" ss:StyleID="TableHeader"><Data ss:Type="String">Banco Receptor</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="TableHeader"><Data ss:Type="String">Total Movimientos</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="TableHeader"><Data ss:Type="String">Aprobados</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="TableHeader"><Data ss:Type="String">En Proceso</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="TableHeader"><Data ss:Type="String">Total Recaudado (USD)</Data></Cell>
   </Row>
   ${bankGroups
     .map(
       (group) => `<Row ss:Height="20">
    <Cell ss:MergeAcross="1" ss:StyleID="CellDefault"><Data ss:Type="String">${escapeXml(group.bankName)}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CellCenter"><Data ss:Type="Number">${group.payments.length}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CellCenter"><Data ss:Type="String">${group.approvedCount} (${escapeXml(formatPaymentAmount(group.approvedAmount))})</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CellCenter"><Data ss:Type="String">${group.inProcessCount} (${escapeXml(formatPaymentAmount(group.inProcessAmount))})</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="CellCurrency"><Data ss:Type="Number">${group.totalAmount}</Data></Cell>
   </Row>`,
     )
     .join("\n   ")}
   <Row ss:Height="24">
    <Cell ss:MergeAcross="1" ss:StyleID="GrandTotalRow"><Data ss:Type="String">TOTAL GENERAL</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="GrandTotalRow"><Data ss:Type="Number">${totalPayments}</Data></Cell>
    <Cell ss:MergeAcross="6" ss:StyleID="GrandTotalCurrency"><Data ss:Type="Number">${grandTotalAmount}</Data></Cell>
   </Row>

   <Row ss:Height="16"><Cell ss:MergeAcross="10"/></Row>

   <!-- DETALLE COMPLETO DE PAGOS -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="10" ss:StyleID="SectionHeader"><Data ss:Type="String">  DETALLE DE MOVIMIENTOS BANCARIOS</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">N°</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Banco Receptor</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Cédula / RIF</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Cliente / Titular</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Referencia</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Estado</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">F. Aprobación</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Monto (USD)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Monto en Bs</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Comentario / Nota</Data></Cell>
   </Row>

   ${
     payments.length === 0
       ? `<Row ss:Height="24">
    <Cell ss:MergeAcross="10" ss:StyleID="CellCenter"><Data ss:Type="String">No se encontraron movimientos registrados en los bancos y fechas seleccionadas.</Data></Cell>
   </Row>`
       : bankGroups
           .map((group) => {
             const groupHeaderRow = `<Row ss:Height="22">
    <Cell ss:MergeAcross="10" ss:StyleID="BankGroupHeader"><Data ss:Type="String">  BANCO: ${escapeXml(group.bankName.toUpperCase())} (${group.payments.length} movimientos · Subtotal: ${escapeXml(formatPaymentAmount(group.totalAmount))})</Data></Cell>
   </Row>`;

             const rows = group.payments
               .map((payment, index) => {
                 const statusLabel =
                   CRM_PAYMENT_STATUS_LABELS[payment.status] || payment.status;
                 const statusStyle =
                   payment.status === "APROBADO"
                     ? "CellStatusApproved"
                     : payment.status === "EN_PROCESO" || payment.status === "RECIBIDO"
                       ? "CellStatusPending"
                       : "CellCenter";
                 const amountUsd = Number(payment.amount) || 0;
                 const amountBs = payment.amount_raw || "—";
                 const clientName = payment.client_name || "Desconocido";
                 const cedula = payment.cedula || "—";
                 const refCode = payment.transaction_code || "—";
                 const comment = payment.comment || "—";
                 const paymentDate = payment.payment_date?.slice(0, 10) || "—";
                 const approvedAt = getPaymentApprovedAt(payment);
                 const approvedDateText = approvedAt
                   ? formatPaymentDateTime(approvedAt)
                   : "—";

                 return `<Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(paymentDate)}</Data></Cell>
    <Cell ss:StyleID="CellDefault"><Data ss:Type="String">${escapeXml(group.bankName)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(cedula)}</Data></Cell>
    <Cell ss:StyleID="CellDefault"><Data ss:Type="String">${escapeXml(clientName)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(refCode)}</Data></Cell>
    <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${escapeXml(statusLabel)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(approvedDateText)}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${amountUsd}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(amountBs)}</Data></Cell>
    <Cell ss:StyleID="CellDefault"><Data ss:Type="String">${escapeXml(comment)}</Data></Cell>
   </Row>`;
               })
               .join("\n   ");

             const subtotalRow = `<Row ss:Height="22">
    <Cell ss:MergeAcross="7" ss:StyleID="BankSubtotalRow"><Data ss:Type="String">  SUBTOTAL ${escapeXml(group.bankName.toUpperCase())} (${group.payments.length} pagos)</Data></Cell>
    <Cell ss:StyleID="BankSubtotalCurrency"><Data ss:Type="Number">${group.totalAmount}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="BankSubtotalRow"/>
   </Row>`;

             return `${groupHeaderRow}\n   ${rows}\n   ${subtotalRow}`;
           })
           .join("\n   ")
   }

   <!-- FILA FINAL DE TOTAL GENERAL -->
   <Row ss:Height="26">
    <Cell ss:MergeAcross="7" ss:StyleID="GrandTotalRow"><Data ss:Type="String">  TOTAL GENERAL DE PAGOS RECIBIDOS (${totalPayments} pagos)</Data></Cell>
    <Cell ss:StyleID="GrandTotalCurrency"><Data ss:Type="Number">${grandTotalAmount}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="GrandTotalRow"/>
   </Row>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>10</SplitHorizontal>
   <TopRowBottomPane>10</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
};

/**
 * Fallback CSV export with UTF-8 BOM so Excel opens special characters correctly.
 */
export const generatePaymentsCsv = (options: PaymentsExportOptions): string => {
  const { payments, selectedBanks, dateRange, statusFilter } = options;

  const headerLines = [
    `# INNOVER CORP - REPORTE DE PAGOS RECIBIDOS`,
    `# Rango de fechas: ${dateRange.from || "inicio"} al ${dateRange.to || "hoy"}`,
    `# Bancos: ${selectedBanks.length ? selectedBanks.join(" | ") : "Todos"}`,
    statusFilter && statusFilter !== "all" ? `# Filtro de estado: ${statusFilter}` : "",
    "",
    [
      "Nro",
      "Fecha",
      "Banco Receptor",
      "Cedula/RIF",
      "Cliente",
      "Referencia",
      "Estado",
      "Fecha Aprobacion",
      "Monto USD",
      "Monto Bs",
      "Comentario",
    ].join(","),
  ].filter(Boolean);

  let counter = 1;
  let totalUsd = 0;

  const dataLines = payments.map((p) => {
    const rawBank = p.bank;
    const bank = normalizeReceptorBank(rawBank) || rawBank || "Sin banco";
    const amount = Number(p.amount) || 0;
    totalUsd = roundMoney(totalUsd + amount);
    const approvedAt = getPaymentApprovedAt(p);
    const approvedText = approvedAt ? formatPaymentDateTime(approvedAt) : "—";

    return [
      counter++,
      escapeCsv(p.payment_date?.slice(0, 10)),
      escapeCsv(bank),
      escapeCsv(p.cedula),
      escapeCsv(p.client_name),
      escapeCsv(p.transaction_code),
      escapeCsv(CRM_PAYMENT_STATUS_LABELS[p.status] || p.status),
      escapeCsv(approvedText),
      amount.toFixed(2),
      escapeCsv(p.amount_raw),
      escapeCsv(p.comment),
    ].join(",");
  });

  const totalLine = [
    "",
    "",
    "TOTAL GENERAL",
    "",
    `${payments.length} pagos`,
    "",
    "",
    "",
    totalUsd.toFixed(2),
    "",
    "",
  ].join(",");

  return `\uFEFF${headerLines.join("\n")}\n${dataLines.join("\n")}\n\n${totalLine}\n`;
};

/**
 * Triggers a file download directly in the user's browser.
 */
export const downloadExportFile = (
  content: string,
  fileName: string,
  mimeType: string,
): void => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
