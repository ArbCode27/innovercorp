import type {
  CrmWisproCaso,
  ResultadoCaso,
  WisproCategory,
  WisproClientHit,
  WisproContractHit,
  WisproEmployee,
  WisproIssueHit,
} from "@/lib/wispro-types";
import type { CreateCasoInput, RetryCasoInput } from "./wispro-caso-schema";

const parseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error || `${fallback} (HTTP ${response.status})`;
};

export const wisproCasoClient = {
  async loadCatalog(input?: {
    refresh?: boolean;
    allEmployees?: boolean;
  }) {
    const params = new URLSearchParams();
    if (input?.refresh) params.set("refresh", "1");
    if (input?.allEmployees) params.set("allEmployees", "1");
    const response = await fetch(
      `/api/crm/wispro/catalog?${params.toString()}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as {
      categories?: WisproCategory[];
      employees?: WisproEmployee[];
      allCount?: number;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || `No se cargó el catálogo (HTTP ${response.status})`);
    }
    return {
      categories: payload.categories || [],
      employees: payload.employees || [],
      allCount: payload.allCount || 0,
    };
  },

  async searchClients(query: string) {
    const response = await fetch(
      `/api/crm/wispro/clients-search?q=${encodeURIComponent(query)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as {
      clients?: WisproClientHit[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || await parseError(response, "No se buscaron clientes"));
    }
    return payload.clients || [];
  },

  async getClient(id: string) {
    const response = await fetch(
      `/api/crm/wispro/clients-search?id=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as {
      clients?: WisproClientHit[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "No se cargó el cliente");
    }
    return payload.clients?.[0] || null;
  },

  async listContracts(clientId: string) {
    const response = await fetch(
      `/api/crm/wispro/contracts?clientId=${encodeURIComponent(clientId)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as {
      contracts?: WisproContractHit[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "No se cargaron los contratos");
    }
    return payload.contracts || [];
  },

  async listCrmCasos() {
    const response = await fetch("/api/casos", { cache: "no-store" });
    const payload = (await response.json()) as {
      casos?: CrmWisproCaso[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "No se cargaron los casos del CRM");
    }
    return payload.casos || [];
  },

  async listIssues() {
    const response = await fetch("/api/crm/wispro/issues", { cache: "no-store" });
    const payload = (await response.json()) as {
      issues?: WisproIssueHit[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "No se cargaron los tickets");
    }
    return payload.issues || [];
  },

  async createCaso(input: CreateCasoInput) {
    const response = await fetch("/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as ResultadoCaso & { error?: string };
    if (!response.ok && !payload.ticket) {
      throw new Error(payload.error || `No se creó el caso (HTTP ${response.status})`);
    }
    return payload as ResultadoCaso;
  },

  async retryCaso(input: RetryCasoInput) {
    const response = await fetch("/api/casos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as ResultadoCaso & { error?: string };
    if (!response.ok && !payload.ticket) {
      throw new Error(payload.error || `No se reintentó el caso (HTTP ${response.status})`);
    }
    return payload as ResultadoCaso;
  },

  async manageCaso(input: { action: "finalize"; issueId: string } | {
    action: "reassign";
    issueId: string;
    employeeId: string;
  }) {
    const response = await fetch("/api/casos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      action?: string;
      caso?: CrmWisproCaso;
      error?: string;
      wispro?: { ok?: boolean; state?: string };
      orden?: { ok?: boolean | null; error?: string };
    };
    if (!response.ok) {
      throw new Error(payload.error || `No se actualizó el ticket (HTTP ${response.status})`);
    }
    return payload;
  },

  async uploadFacade(file: File) {
    const body = new FormData();
    body.append("image", file);
    const response = await fetch("/api/crm/media/facade", {
      method: "POST",
      body,
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "No se subió la foto de fachada");
    }
    return payload.url;
  },
};
