export type WisproCategory = {
  id: string;
  name: string;
  level: "High" | "Low" | string;
  public_for_mobile: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type WisproEmployee = {
  id: string;
  public_id: number | null;
  name: string;
  phone: string | null;
  phone_mobile: string | null;
  national_identification_number: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type WisproClientHit = {
  id: string;
  name: string;
  national_identification_number: string | null;
  phone_mobile: string | null;
};

export type WisproContractHit = {
  id: string;
  public_id: number | null;
  client_id: string | null;
  state: string | null;
  plan_name: string | null;
  street: string | null;
  number: string | null;
  city: string | null;
  state_name: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type WisproIssueHit = {
  id: string;
  public_id: number | null;
  title: string;
  category_id: string | null;
  client_id: string | null;
  contract_id: string | null;
  created_at: string | null;
};

export type CreateIssueInput = {
  title: string;
  description: string;
  categoryId: string;
  clientId?: string | null;
  contractId?: string | null;
  assignableId?: string | null;
};

export type CreateOrderInput = {
  kind: "installation" | "technical" | "resignation" | "feasibility";
  description?: string | null;
  ticketId: string;
  contractId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  gps?: {
    street?: string | null;
    number?: string | null;
    city?: string | null;
    state?: string | null;
    countryCode?: string | null;
    latitude: number;
    longitude: number;
  } | null;
};

export type CrmWisproCasoStatus = "open" | "scheduled" | "done" | "cancelled";

export type CrmWisproCaso = {
  id: string;
  conversationId: number | null;
  crmClientId: number | null;
  wisproClientId: string | null;
  wisproIssueId: string;
  wisproPublicId: number | null;
  wisproOrderId: string | null;
  employeeId: string | null;
  employeeName: string | null;
  employeePhone: string | null;
  employeeDocument: string | null;
  status: CrmWisproCasoStatus;
  kind: string | null;
  title: string;
  cause: string | null;
  description: string | null;
  clientName: string | null;
  clientPhone: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  addressText: string | null;
  facadeMediaUrl: string | null;
  facadeMessageId: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  lastTechnicianReportAt: string | null;
  lastTechnicianReportKey: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ResultadoCaso = {
  ticket:
    | { ok: true; id: string; publicId: number | null }
    | { ok: false; error: string };
  orden: { ok: true; id: string } | { ok: false; error: string } | { ok: null };
  tecnico: { ok: true } | { ok: false; error: string } | { ok: null };
  crm?: { ok: true; id: string } | { ok: false; error: string } | { ok: null };
};
