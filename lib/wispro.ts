import tecnicosConfig from "@/config/tecnicos.json";
import type {
  CreateIssueInput,
  CreateOrderInput,
  ResultadoCaso,
  WisproCategory,
  WisproClientHit,
  WisproContractHit,
  WisproEmployee,
  WisproIssueHit,
} from "./wispro-types";

export type {
  CreateIssueInput,
  CreateOrderInput,
  ResultadoCaso,
  WisproCategory,
  WisproClientHit,
  WisproContractHit,
  WisproEmployee,
  WisproIssueHit,
} from "./wispro-types";

const LOG_PREFIX = "[WISPRO]";
const DEFAULT_BASE_URL = "https://www.cloud.wispro.co/api/v1";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

export class WisproHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "WisproHttpError";
    this.status = status;
    this.body = body;
  }
}

type CacheEntry<T> = { expiresAt: number; value: T };

const catalogCache = new Map<string, CacheEntry<unknown>>();
const CATALOG_TTL_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getConfig = () => {
  const token = (
    process.env.WISPRO_API_KEY ||
    process.env.WISPRO_API_TOKEN ||
    ""
  ).trim();
  if (!token) {
    throw new WisproHttpError(
      "WISPRO_API_KEY / WISPRO_API_TOKEN no está configurado en el servidor",
      503,
      "",
    );
  }

  const baseUrl = (
    process.env.WISPRO_BASE_URL?.trim() ||
    process.env.WISPRO_API_BASE_URL?.trim() ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");

  return { token, baseUrl };
};

const readString = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const readNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const unwrapDataArray = (payload: unknown): unknown[] => {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  if (Array.isArray(root.data)) return root.data;
  if (root.data && typeof root.data === "object") return [root.data];
  return [];
};

const unwrapCreated = <T>(payload: unknown): T => {
  const first = unwrapDataArray(payload)[0];
  if (!first || typeof first !== "object") {
    throw new WisproHttpError(
      "Wispro no devolvió data[0] en la creación",
      502,
      JSON.stringify(payload).slice(0, 800),
    );
  }
  return first as T;
};

const formatErrorMessage = (status: number, body: string) => {
  const trimmed = body.trim();
  if (!trimmed) return `Wispro HTTP ${status}`;
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: unknown;
      message?: unknown;
      errors?: unknown;
    };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return `HTTP ${status}: ${parsed.error}`;
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return `HTTP ${status}: ${parsed.message}`;
    }
  } catch {
    // Use raw body below.
  }
  return `HTTP ${status}: ${trimmed.slice(0, 800)}`;
};

const shouldRetry = (method: string, status: number | null) => {
  if (status == null) return true;
  if (status >= 500) return true;
  void method;
  return false;
};

type WisproRequestInput = {
  method: "GET" | "POST" | "PUT" | "PATCH";
  path: string;
  query?: Record<string, string | number | null | undefined>;
  json?: unknown;
};

const wisproRequest = async (input: WisproRequestInput): Promise<unknown> => {
  const { token, baseUrl } = getConfig();
  const url = new URL(
    `${baseUrl}${input.path.startsWith("/") ? input.path : `/${input.path}`}`,
  );
  for (const [key, value] of Object.entries(input.query || {})) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const logPath = `${url.pathname}${url.search}`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: input.method,
        headers: {
          Accept: "application/json",
          Authorization: token,
          ...(input.json !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: input.json !== undefined ? JSON.stringify(input.json) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      const rawBody = await response.text();
      console.log(`${LOG_PREFIX} ${input.method} ${logPath} ${response.status}`);

      if (!response.ok) {
        const error = new WisproHttpError(
          formatErrorMessage(response.status, rawBody),
          response.status,
          rawBody,
        );
        if (attempt < MAX_RETRIES && shouldRetry(input.method, response.status)) {
          lastError = error;
          await sleep(300 * 2 ** attempt);
          continue;
        }
        throw error;
      }

      if (!rawBody.trim()) return { data: [] };
      return JSON.parse(rawBody) as unknown;
    } catch (error) {
      if (error instanceof WisproHttpError) throw error;
      lastError = error;
      console.error(`${LOG_PREFIX} ${input.method} ${logPath} network_error`, {
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt >= MAX_RETRIES) {
        throw new WisproHttpError(
          error instanceof Error
            ? error.message
            : "No se pudo conectar con Wispro",
          502,
          "",
        );
      }
      await sleep(300 * 2 ** attempt);
    }
  }

  throw lastError instanceof WisproHttpError
    ? lastError
    : new WisproHttpError("No se pudo conectar con Wispro", 502, "");
};

const getCached = async <T>(
  key: string,
  loader: () => Promise<T>,
  forceRefresh = false,
): Promise<T> => {
  const now = Date.now();
  const hit = catalogCache.get(key) as CacheEntry<T> | undefined;
  if (!forceRefresh && hit && hit.expiresAt > now) return hit.value;
  const value = await loader();
  catalogCache.set(key, { value, expiresAt: now + CATALOG_TTL_MS });
  return value;
};

const normalizeCategory = (record: unknown): WisproCategory | null => {
  if (!record || typeof record !== "object") return null;
  const row = record as Record<string, unknown>;
  const id = readString(row.id);
  const name = readString(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    level: readString(row.level) || "Low",
    public_for_mobile:
      typeof row.public_for_mobile === "boolean" ? row.public_for_mobile : null,
    created_at: readString(row.created_at),
    updated_at: readString(row.updated_at),
  };
};

const normalizeEmployee = (record: unknown): WisproEmployee | null => {
  if (!record || typeof record !== "object") return null;
  const row = record as Record<string, unknown>;
  const id = readString(row.id);
  const name = readString(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    public_id: readNumber(row.public_id),
    phone: readString(row.phone),
    phone_mobile: readString(row.phone_mobile),
    national_identification_number:
      readString(row.national_identification_number) ||
      readString(row.identification_number) ||
      readString(row.document_number) ||
      readString(row.document) ||
      readString(row.dni),
    created_at: readString(row.created_at),
    updated_at: readString(row.updated_at),
  };
};

const readGpsNumber = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = readNumber(row[key]);
    if (value != null) return value;
  }
  return null;
};

const normalizeContractHit = (record: unknown): WisproContractHit | null => {
  if (!record || typeof record !== "object") return null;
  const row = record as Record<string, unknown>;
  const id = readString(row.id);
  if (!id) return null;
  const gps =
    row.gps_point && typeof row.gps_point === "object"
      ? (row.gps_point as Record<string, unknown>)
      : row.address && typeof row.address === "object"
        ? (row.address as Record<string, unknown>)
        : row;
  const plan =
    row.plan && typeof row.plan === "object"
      ? (row.plan as Record<string, unknown>)
      : null;

  return {
    id,
    public_id: readNumber(row.public_id),
    client_id: readString(row.client_id),
    state: readString(row.state),
    plan_name:
      readString(row.plan_name) ||
      (plan ? readString(plan.name) : null) ||
      null,
    street: readString(gps.street) || readString(row.street),
    number: readString(gps.number) || readString(row.number),
    city: readString(gps.city) || readString(row.city),
    state_name: readString(gps.state) || readString(row.state_name),
    country_code: readString(gps.country_code) || readString(row.country_code) || "VE",
    latitude: readGpsNumber(gps, ["latitude", "lat"]),
    longitude: readGpsNumber(gps, ["longitude", "lng", "lon"]),
  };
};

const technicianAllowlist = () =>
  (tecnicosConfig.employeeIds || []).map((id) => String(id).trim()).filter(Boolean);

export const listHelpDeskCategories = async (forceRefresh = false) =>
  getCached(
    "help_desk_categories",
    async () => {
      const payload = await wisproRequest({
        method: "GET",
        path: "/help_desk/categories",
      });
      return unwrapDataArray(payload)
        .map(normalizeCategory)
        .filter((item): item is WisproCategory => Boolean(item));
    },
    forceRefresh,
  );

export const listEmployees = async (forceRefresh = false) =>
  getCached(
    "employees",
    async () => {
      const payload = await wisproRequest({
        method: "GET",
        path: "/employees",
      });
      return unwrapDataArray(payload)
        .map(normalizeEmployee)
        .filter((item): item is WisproEmployee => Boolean(item));
    },
    forceRefresh,
  );

export const listTechnicians = async (input?: {
  includeAll?: boolean;
  forceRefresh?: boolean;
}) => {
  const employees = await listEmployees(Boolean(input?.forceRefresh));
  const allowlist = technicianAllowlist();
  if (input?.includeAll || allowlist.length === 0) return employees;
  const allowed = new Set(allowlist);
  return employees.filter((employee) => allowed.has(employee.id));
};

export const searchWisproClients = async (query: string) => {
  const q = query.trim();
  if (q.length < 2) return [] as WisproClientHit[];

  const digits = q.replace(/\D/g, "");
  const requestQuery = digits.length >= 5 && digits === q.replace(/\s/g, "")
    ? { national_identification_number_eq: digits }
    : { name_cont: q };

  const payload = await wisproRequest({
    method: "GET",
    path: "/clients",
    query: requestQuery,
  });

  return unwrapDataArray(payload)
    .map((record) => {
      if (!record || typeof record !== "object") return null;
      const row = record as Record<string, unknown>;
      const id = readString(row.id);
      const name = readString(row.name);
      if (!id || !name) return null;
      return {
        id,
        name,
        national_identification_number: readString(
          row.national_identification_number,
        ),
        phone_mobile: readString(row.phone_mobile),
      } satisfies WisproClientHit;
    })
    .filter((item): item is WisproClientHit => Boolean(item));
};

export const getWisproClientById = async (clientId: string) => {
  const payload = await wisproRequest({
    method: "GET",
    path: `/clients/${encodeURIComponent(clientId)}`,
  });
  const row = unwrapDataArray(payload)[0];
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = readString(record.id);
  const name = readString(record.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    national_identification_number: readString(
      record.national_identification_number,
    ),
    phone_mobile: readString(record.phone_mobile),
  } satisfies WisproClientHit;
};

export const listContractsForClient = async (clientId: string) => {
  const payload = await wisproRequest({
    method: "GET",
    path: "/contracts",
    query: { client_id_eq: clientId },
  });
  return unwrapDataArray(payload)
    .map(normalizeContractHit)
    .filter((item): item is WisproContractHit => Boolean(item));
};

export const listHelpDeskIssues = async () => {
  const payload = await wisproRequest({
    method: "GET",
    path: "/help_desk/issues",
  });
  return unwrapDataArray(payload)
    .map((record): WisproIssueHit | null => {
      if (!record || typeof record !== "object") return null;
      const row = record as Record<string, unknown>;
      const id = readString(row.id);
      if (!id) return null;
      return {
        id,
        public_id: readNumber(row.public_id),
        title: readString(row.title) || "Sin título",
        category_id: readString(row.category_id),
        client_id: readString(row.client_id),
        contract_id: readString(row.contract_id),
        created_at: readString(row.created_at),
      };
    })
    .filter((item): item is WisproIssueHit => Boolean(item));
};

/**
 * Wispro OpenAPI documents POST /help_desk/issues with query-string params,
 * not a JSON body. Do not send `{ issue: ... }` here.
 */
export const createHelpDeskIssue = async (input: CreateIssueInput) => {
  const payload = await wisproRequest({
    method: "POST",
    path: "/help_desk/issues",
    query: {
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      client_id: input.clientId || undefined,
      contract_id: input.contractId || undefined,
      assignable_id: input.assignableId || undefined,
    },
  });
  const created = unwrapCreated<{ id?: unknown; public_id?: unknown }>(payload);
  const id = readString(created.id);
  if (!id) {
    throw new WisproHttpError(
      "Wispro creó el ticket sin UUID",
      502,
      JSON.stringify(created).slice(0, 800),
    );
  }
  return {
    id,
    publicId: readNumber(created.public_id),
  };
};

export const createWorkOrder = async (input: CreateOrderInput) => {
  const order: Record<string, unknown> = {
    state: "pending",
    kind: input.kind,
    result: "not_set",
    ticketable_id: input.ticketId,
    ticketable_type: "HelpDesk",
  };
  if (input.description?.trim()) order.description = input.description.trim();
  if (input.contractId) {
    order.orderable_id = input.contractId;
    order.orderable_type = "Contract";
  }
  if (input.startAt) order.start_at = input.startAt;
  if (input.endAt) order.end_at = input.endAt;

  const body: Record<string, unknown> = { order };
  if (input.gps) {
    body.gps_point_attributes = {
      street: input.gps.street || "",
      number: input.gps.number || "",
      city: input.gps.city || "",
      state: input.gps.state || "",
      country_code: input.gps.countryCode || "VE",
      latitude: input.gps.latitude,
      longitude: input.gps.longitude,
    };
  }

  const payload = await wisproRequest({
    method: "POST",
    path: "/order/orders",
    json: body,
  });
  const created = unwrapCreated<{ id?: unknown }>(payload);
  const id = readString(created.id);
  if (!id) {
    throw new WisproHttpError(
      "Wispro creó la orden sin UUID",
      502,
      JSON.stringify(created).slice(0, 800),
    );
  }
  return { id };
};

export const rescheduleOrder = async (
  orderId: string,
  body: Record<string, unknown>,
) =>
  wisproRequest({
    method: "POST",
    path: `/order/orders/${encodeURIComponent(orderId)}/reschedule`,
    json: body,
  });

export const finalizeOrder = async (orderId: string) =>
  wisproRequest({
    method: "POST",
    path: `/order/orders/${encodeURIComponent(orderId)}/finalize`,
    json: {},
  });

export const closeOrder = async (orderId: string) =>
  wisproRequest({
    method: "POST",
    path: `/order/orders/${encodeURIComponent(orderId)}/close`,
    json: {},
  });

export const updateHelpDeskIssue = async (input: {
  issueId: string;
  state?: "closed" | "pending" | "finalized";
  assignableId?: string | null;
}) => {
  const query: Record<string, string> = { id: input.issueId };
  if (input.state) query.state = input.state;
  if (input.assignableId) query.assignable_id = input.assignableId;

  return wisproRequest({
    method: "PUT",
    path: `/help_desk/issues/${encodeURIComponent(input.issueId)}`,
    query,
  });
};

export const closeHelpDeskIssue = async (issueId: string) => {
  try {
    await updateHelpDeskIssue({ issueId, state: "finalized" });
    return { ok: true as const, state: "finalized" as const };
  } catch (finalizedError) {
    try {
      await updateHelpDeskIssue({ issueId, state: "closed" });
      return { ok: true as const, state: "closed" as const };
    } catch {
      throw finalizedError;
    }
  }
};

export const closeWorkOrderIfPresent = async (orderId: string | null | undefined) => {
  if (!orderId) return { ok: null } as const;
  try {
    await finalizeOrder(orderId);
    return { ok: true } as const;
  } catch {
    try {
      await closeOrder(orderId);
      return { ok: true } as const;
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo cerrar la orden",
      };
    }
  }
};

export const reassignHelpDeskIssue = async (input: {
  issueId: string;
  employeeId: string;
}) =>
  updateHelpDeskIssue({
    issueId: input.issueId,
    state: "pending",
    assignableId: input.employeeId,
  });

export const createCaso = async (input: {
  issue: CreateIssueInput;
  order?: CreateOrderInput | null;
}): Promise<ResultadoCaso> => {
  let ticket: ResultadoCaso["ticket"];
  try {
    const created = await createHelpDeskIssue(input.issue);
    ticket = { ok: true, id: created.id, publicId: created.publicId };
  } catch (error) {
    return {
      ticket: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      orden: input.order ? { ok: false, error: "No se creó porque falló el ticket" } : { ok: null },
      tecnico: { ok: null },
    };
  }

  if (!input.order) {
    return { ticket, orden: { ok: null }, tecnico: { ok: null } };
  }

  try {
    const createdOrder = await createWorkOrder({
      ...input.order,
      ticketId: ticket.ok ? ticket.id : input.order.ticketId,
    });
    return { ticket, orden: { ok: true, id: createdOrder.id }, tecnico: { ok: null } };
  } catch (error) {
    return {
      ticket,
      orden: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      tecnico: { ok: null },
    };
  }
};

export const retryCasoSteps = async (input: {
  ticketId: string;
  order?: CreateOrderInput | null;
  existingOrderId?: string | null;
}): Promise<ResultadoCaso> => {
  const ticket: ResultadoCaso["ticket"] = {
    ok: true,
    id: input.ticketId,
    publicId: null,
  };

  const orderId = input.existingOrderId?.trim() || null;
  if (orderId) {
    return { ticket, orden: { ok: true, id: orderId }, tecnico: { ok: null } };
  }

  if (!input.order) {
    return { ticket, orden: { ok: null }, tecnico: { ok: null } };
  }

  try {
    const created = await createWorkOrder({
      ...input.order,
      ticketId: input.ticketId,
    });
    return { ticket, orden: { ok: true, id: created.id }, tecnico: { ok: null } };
  } catch (error) {
    return {
      ticket,
      orden: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      tecnico: { ok: null },
    };
  }
};
