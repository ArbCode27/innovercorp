import type { SupabaseClient } from "@supabase/supabase-js";
import { PERFORMANCE_CONFIG } from "./crm-performance-config";

export type PerformancePeriod = "month" | "last_month" | "week" | "all";

export interface AgentPerformanceMetric {
  agentId: number;
  name: string;
  email: string;
  initials: string | null;
  avatarColor: string | null;
  avatarBg: string | null;
  resolvedCases: number;
  avgDurationMinutes: number;
  reopenedCases: number;
  fcrRate: number; // First Contact Resolution (No-reapertura) 0 - 100%
  satisfactionRating: number; // 1.0 - 5.0 estrellas calculadas objetivamente
  score: number; // 0 - 100 (puntaje ponderado bayesiano)
  rawScore: number; // 0 - 100 (calidad cruda antes del factor de volumen)
  isEligibleForPodium: boolean;
  rank: number;
  badge?: "gold" | "silver" | "bronze" | null;
}

export interface TechnicianPerformanceMetric {
  employeeId: string;
  name: string;
  totalAssigned: number;
  resolvedCount: number;
  pendingCount: number;
  resolutionRate: number; // 0 - 100%
  avgResolutionHours: number;
  punctualityRate: number; // 0 - 100%
  score: number; // 0 - 100 (puntaje ponderado bayesiano)
  rawScore: number; // 0 - 100 (calidad cruda antes del factor de volumen)
  isEligibleForPodium: boolean;
  rank: number;
  badge?: "gold" | "silver" | "bronze" | null;
}

export interface PerformanceDashboardData {
  period: PerformancePeriod;
  dateRange: { from: string | null; to: string | null };
  summary: {
    totalConversationsResolved: number;
    avgAgentDurationMinutes: number;
    agentFcrRate: number;
    totalTicketsAssigned: number;
    totalTicketsResolved: number;
    technicianResolutionRate: number;
  };
  bestAgent: AgentPerformanceMetric | null;
  bestTechnician: TechnicianPerformanceMetric | null;
  agents: AgentPerformanceMetric[];
  technicians: TechnicianPerformanceMetric[];
}

export const getPeriodDateRange = (
  period: PerformancePeriod,
  now = new Date(),
): { from: string | null; to: string | null } => {
  if (period === "all") {
    return { from: null, to: null };
  }
  if (period === "week") {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to: now.toISOString() };
  }
  if (period === "last_month") {
    const year = now.getFullYear();
    const month = now.getMonth();
    const fromDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const toDate = new Date(year, month, 0, 23, 59, 59, 999);
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }
  // current month
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { from: fromDate.toISOString(), to: now.toISOString() };
};

/**
 * Promedio ponderado bayesiano (modelo IMDB) para incorporar el volumen como factor de confianza:
 * puntaje_ajustado = (v / (v + m)) * R + (m / (v + m)) * C
 *
 * @param volume (v) Número de casos/tickets resueltos en el período
 * @param minVolumeConfidence (m) Umbral mínimo de volumen para confianza plena (configurable)
 * @param rawQuality (R) Puntaje de calidad crudo del agente/técnico (0 - 100)
 * @param groupAverageQuality (C) Media global de calidad del grupo en el período
 */
export const calculateBayesianScore = (params: {
  volume: number;
  minVolumeConfidence: number;
  rawQuality: number;
  groupAverageQuality: number;
}): number => {
  const { volume, minVolumeConfidence, rawQuality, groupAverageQuality } = params;
  if (volume <= 0) return 0;

  const v = Math.max(0, volume);
  const m = Math.max(1, minVolumeConfidence);
  const R = Math.max(0, Math.min(100, rawQuality));
  const C = Math.max(0, Math.min(100, groupAverageQuality));

  const weighted = (v / (v + m)) * R + (m / (v + m)) * C;
  return Math.round(weighted * 10) / 10;
};

/**
 * Calcula la calidad cruda R (0 - 100) para un asesor de oficina:
 * - FCR / Satisfacción estimada: peso configurable (default 65%)
 * - Velocidad / Duración promedio: peso configurable (default 35%)
 */
export const calculateAgentRawQuality = (params: {
  fcrRate: number;
  avgDurationMinutes: number;
}): number => {
  const satisfactionScore = Math.max(0, Math.min(100, params.fcrRate));

  let speedScore = 100;
  if (params.avgDurationMinutes > 120) {
    speedScore = 30;
  } else if (params.avgDurationMinutes > 60) {
    speedScore = 50;
  } else if (params.avgDurationMinutes > 30) {
    speedScore = 75;
  } else if (params.avgDurationMinutes > 15) {
    speedScore = 90;
  }

  const { fcr, speed } = PERFORMANCE_CONFIG.agents.weights;
  const raw = satisfactionScore * fcr + speedScore * speed;
  return Math.round(raw * 10) / 10;
};

/**
 * Calcula la calidad cruda R (0 - 100) para un técnico de campo:
 * - Tasa de resolución (Resueltos / Asignados): peso configurable (default 60%)
 * - Puntualidad dentro de la ventana horaria: peso configurable (default 40%)
 */
export const calculateTechnicianRawQuality = (params: {
  resolutionRate: number;
  punctualityRate: number;
}): number => {
  const resolutionScore = Math.max(0, Math.min(100, params.resolutionRate));
  const punctualityScore = Math.max(0, Math.min(100, params.punctualityRate));

  const { resolution, punctuality } = PERFORMANCE_CONFIG.technicians.weights;
  const raw = resolutionScore * resolution + punctualityScore * punctuality;
  return Math.round(raw * 10) / 10;
};

/**
 * Calcula la media global C del grupo para un período dado.
 */
export const calculateGroupAverageQuality = (
  rawScores: number[],
  fallbackPrior = 70,
): number => {
  if (rawScores.length === 0) return fallbackPrior;
  const sum = rawScores.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / rawScores.length) * 10) / 10;
};

/**
 * Calcula el puntaje final ajustado para un asesor de oficina aplicando ponderación bayesiana.
 */
export const calculateAgentScore = (params: {
  resolvedCases: number;
  fcrRate: number;
  avgDurationMinutes: number;
  maxCasesInPeriod?: number; // compatibilidad retroactiva
  groupAverageQuality?: number;
  minVolumeConfidence?: number;
}): number => {
  if (params.resolvedCases === 0) return 0;

  const rawQuality = calculateAgentRawQuality({
    fcrRate: params.fcrRate,
    avgDurationMinutes: params.avgDurationMinutes,
  });

  return calculateBayesianScore({
    volume: params.resolvedCases,
    minVolumeConfidence:
      params.minVolumeConfidence ?? PERFORMANCE_CONFIG.agents.minVolumeConfidence,
    rawQuality,
    groupAverageQuality:
      params.groupAverageQuality ?? PERFORMANCE_CONFIG.agents.defaultPriorQuality,
  });
};

/**
 * Calcula el puntaje final ajustado para un técnico de campo aplicando ponderación bayesiana.
 */
export const calculateTechnicianScore = (params: {
  totalAssigned: number;
  resolvedCount: number;
  resolutionRate: number;
  punctualityRate: number;
  maxResolvedInPeriod?: number; // compatibilidad retroactiva
  groupAverageQuality?: number;
  minVolumeConfidence?: number;
}): number => {
  if (params.totalAssigned === 0 || params.resolvedCount === 0) return 0;

  const rawQuality = calculateTechnicianRawQuality({
    resolutionRate: params.resolutionRate,
    punctualityRate: params.punctualityRate,
  });

  return calculateBayesianScore({
    volume: params.resolvedCount,
    minVolumeConfidence:
      params.minVolumeConfidence ??
      PERFORMANCE_CONFIG.technicians.minVolumeConfidence,
    rawQuality,
    groupAverageQuality:
      params.groupAverageQuality ??
      PERFORMANCE_CONFIG.technicians.defaultPriorQuality,
  });
};

export const fetchPerformanceDashboardData = async (
  supabase: SupabaseClient,
  period: PerformancePeriod = "month",
): Promise<PerformanceDashboardData> => {
  const dateRange = getPeriodDateRange(period);

  // 1. Fetch Agents and Conversation History
  const agentsQuery = supabase
    .from("agents")
    .select("id, name, email, initials, avatar_color, avatar_bg, status")
    .neq("status", "inactive");

  let historyQuery = supabase
    .from("conversation_history")
    .select(
      "id, client_id, client_phone, agent_id, resolved_by, resolved_at, first_message_at, last_message_at",
    )
    .not("resolved_at", "is", null);

  if (dateRange.from) {
    historyQuery = historyQuery.gte("resolved_at", dateRange.from);
  }
  if (dateRange.to) {
    historyQuery = historyQuery.lte("resolved_at", dateRange.to);
  }

  // 2. Fetch Field Technician Casos
  let casosQuery = supabase
    .from("crm_wispro_casos")
    .select(
      "id, employee_id, employee_name, status, window_start, window_end, closed_at, created_at",
    )
    .not("employee_id", "is", null);

  if (dateRange.from) {
    casosQuery = casosQuery.gte("created_at", dateRange.from);
  }
  if (dateRange.to) {
    casosQuery = casosQuery.lte("created_at", dateRange.to);
  }

  const [
    { data: agentsData, error: agentsError },
    { data: historyData, error: historyError },
    { data: casosData, error: casosError },
  ] = await Promise.all([agentsQuery, historyQuery, casosQuery]);

  if (agentsError) {
    throw new Error(agentsError.message || "Error al consultar agentes");
  }
  if (historyError) {
    throw new Error(historyError.message || "Error al consultar conversaciones");
  }
  if (casosError) {
    throw new Error(casosError.message || "Error al consultar tickets de casos");
  }

  const history = historyData || [];
  const casos = casosData || [];
  const agents = agentsData || [];

  // Sort history by client and resolved_at to check for reopening within 24 hours
  const historyByClient = new Map<string, Array<{ resolvedAt: number }>>();
  for (const h of history) {
    const key = String(h.client_id || h.client_phone || "").trim();
    if (!key) continue;
    const resolvedTime = new Date(h.resolved_at).getTime();
    if (isNaN(resolvedTime)) continue;

    if (!historyByClient.has(key)) {
      historyByClient.set(key, []);
    }
    historyByClient.get(key)!.push({ resolvedAt: resolvedTime });
  }

  for (const entries of historyByClient.values()) {
    entries.sort((a, b) => a.resolvedAt - b.resolvedAt);
  }

  // Calculate stats for each agent
  let maxAgentCases = 0;
  const agentStatsMap = new Map<
    number,
    {
      resolvedCases: number;
      reopenedCases: number;
      totalDurationMinutes: number;
      casesWithDuration: number;
    }
  >();

  for (const h of history) {
    const agentId = Number(h.resolved_by || h.agent_id);
    if (!agentId) continue;

    if (!agentStatsMap.has(agentId)) {
      agentStatsMap.set(agentId, {
        resolvedCases: 0,
        reopenedCases: 0,
        totalDurationMinutes: 0,
        casesWithDuration: 0,
      });
    }
    const stat = agentStatsMap.get(agentId)!;
    stat.resolvedCases += 1;

    // Check duration
    if (h.first_message_at && h.resolved_at) {
      const start = new Date(h.first_message_at).getTime();
      const end = new Date(h.resolved_at).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const diffMinutes = Math.round((end - start) / 60000);
        stat.totalDurationMinutes += diffMinutes;
        stat.casesWithDuration += 1;
      }
    }

    // Check reopening in next 24 hours
    const clientKey = String(h.client_id || h.client_phone || "").trim();
    if (clientKey) {
      const clientEntries = historyByClient.get(clientKey);
      if (clientEntries && clientEntries.length > 1) {
        const currentResolvedAt = new Date(h.resolved_at).getTime();
        const nextWithin24h = clientEntries.some(
          (e) =>
            e.resolvedAt > currentResolvedAt &&
            e.resolvedAt - currentResolvedAt <= 24 * 60 * 60 * 1000,
        );
        if (nextWithin24h) {
          stat.reopenedCases += 1;
        }
      }
    }
  }

  // 2. Pre-calcular calidad cruda de agentes para determinar la media global C
  const rawAgentData = agents.map((agent) => {
    const stat = agentStatsMap.get(agent.id) || {
      resolvedCases: 0,
      reopenedCases: 0,
      totalDurationMinutes: 0,
      casesWithDuration: 0,
    };

    const avgDurationMinutes =
      stat.casesWithDuration > 0
        ? Math.round(stat.totalDurationMinutes / stat.casesWithDuration)
        : 0;

    const successfulCases = Math.max(0, stat.resolvedCases - stat.reopenedCases);
    const fcrRate =
      stat.resolvedCases > 0
        ? Math.round((successfulCases / stat.resolvedCases) * 100)
        : 100;

    // Escala 1.0 a 5.0 para representación de estrellas
    const satisfactionRating =
      Math.round((1 + (fcrRate / 100) * 4) * 10) / 10;

    const rawScore =
      stat.resolvedCases > 0
        ? calculateAgentRawQuality({ fcrRate, avgDurationMinutes })
        : 0;

    return {
      agent,
      stat,
      avgDurationMinutes,
      fcrRate,
      satisfactionRating,
      rawScore,
    };
  });

  const activeAgentRawScores = rawAgentData
    .filter((a) => a.stat.resolvedCases > 0)
    .map((a) => a.rawScore);

  const agentGroupAverage = calculateGroupAverageQuality(
    activeAgentRawScores,
    PERFORMANCE_CONFIG.agents.defaultPriorQuality,
  );

  const agentMetrics: AgentPerformanceMetric[] = rawAgentData.map((item) => {
    const isEligibleForPodium =
      item.stat.resolvedCases >= PERFORMANCE_CONFIG.agents.minCasesForPodium;

    const score =
      item.stat.resolvedCases > 0
        ? calculateBayesianScore({
            volume: item.stat.resolvedCases,
            minVolumeConfidence: PERFORMANCE_CONFIG.agents.minVolumeConfidence,
            rawQuality: item.rawScore,
            groupAverageQuality: agentGroupAverage,
          })
        : 0;

    return {
      agentId: item.agent.id,
      name: item.agent.name,
      email: item.agent.email,
      initials: item.agent.initials,
      avatarColor: item.agent.avatar_color,
      avatarBg: item.agent.avatar_bg,
      resolvedCases: item.stat.resolvedCases,
      avgDurationMinutes: item.avgDurationMinutes,
      reopenedCases: item.stat.reopenedCases,
      fcrRate: item.fcrRate,
      satisfactionRating: item.satisfactionRating,
      score,
      rawScore: item.rawScore,
      isEligibleForPodium,
      rank: 0,
    };
  });

  // Ordenar asesores por puntaje bayesiano descendente, luego volumen
  agentMetrics.sort((a, b) => b.score - a.score || b.resolvedCases - a.resolvedCases);

  let eligibleAgentPodiumCount = 0;
  agentMetrics.forEach((item, index) => {
    item.rank = index + 1;
    if (item.resolvedCases > 0 && item.isEligibleForPodium) {
      if (eligibleAgentPodiumCount === 0) item.badge = "gold";
      else if (eligibleAgentPodiumCount === 1) item.badge = "silver";
      else if (eligibleAgentPodiumCount === 2) item.badge = "bronze";
      eligibleAgentPodiumCount += 1;
    } else {
      item.badge = null;
    }
  });

  // 3. Process Technicians
  const techStatsMap = new Map<
    string,
    {
      name: string;
      totalAssigned: number;
      resolvedCount: number;
      pendingCount: number;
      onTimeCount: number;
      totalResolutionHours: number;
      resolvedWithTimeCount: number;
    }
  >();

  for (const c of casos) {
    const employeeId = String(c.employee_id || "").trim();
    if (!employeeId) continue;

    if (!techStatsMap.has(employeeId)) {
      techStatsMap.set(employeeId, {
        name: String(c.employee_name || "Técnico"),
        totalAssigned: 0,
        resolvedCount: 0,
        pendingCount: 0,
        onTimeCount: 0,
        totalResolutionHours: 0,
        resolvedWithTimeCount: 0,
      });
    }
    const stat = techStatsMap.get(employeeId)!;
    stat.totalAssigned += 1;

    const isDone = c.status === "done";
    if (isDone) {
      stat.resolvedCount += 1;

      // Calculate resolution time
      const closedTime = c.closed_at ? new Date(c.closed_at).getTime() : null;
      const startTime = c.window_start
        ? new Date(c.window_start).getTime()
        : c.created_at
          ? new Date(c.created_at).getTime()
          : null;

      if (closedTime && startTime && closedTime >= startTime) {
        const hours = (closedTime - startTime) / (1000 * 60 * 60);
        stat.totalResolutionHours += hours;
        stat.resolvedWithTimeCount += 1;
      }

      // Check punctuality against scheduled window
      if (c.window_end && closedTime) {
        const endTime = new Date(c.window_end).getTime();
        if (closedTime <= endTime) {
          stat.onTimeCount += 1;
        }
      } else {
        // If no window_end, consider on-time if resolved within 24h
        if (closedTime && startTime && closedTime - startTime <= 24 * 3600 * 1000) {
          stat.onTimeCount += 1;
        }
      }
    } else if (c.status === "open" || c.status === "scheduled") {
      stat.pendingCount += 1;
    }
  }

  // 4. Pre-calcular calidad cruda de técnicos para determinar la media global C
  const rawTechData: Array<{
    employeeId: string;
    stat: {
      name: string;
      totalAssigned: number;
      resolvedCount: number;
      pendingCount: number;
      onTimeCount: number;
      totalResolutionHours: number;
      resolvedWithTimeCount: number;
    };
    resolutionRate: number;
    punctualityRate: number;
    avgResolutionHours: number;
    rawScore: number;
  }> = [];

  for (const [employeeId, stat] of techStatsMap.entries()) {
    const resolutionRate =
      stat.totalAssigned > 0
        ? Math.round((stat.resolvedCount / stat.totalAssigned) * 100)
        : 0;

    const punctualityRate =
      stat.resolvedCount > 0
        ? Math.round((stat.onTimeCount / stat.resolvedCount) * 100)
        : 100;

    const avgResolutionHours =
      stat.resolvedWithTimeCount > 0
        ? Math.round((stat.totalResolutionHours / stat.resolvedWithTimeCount) * 10) / 10
        : 0;

    const rawScore =
      stat.resolvedCount > 0
        ? calculateTechnicianRawQuality({
            resolutionRate,
            punctualityRate,
          })
        : 0;

    rawTechData.push({
      employeeId,
      stat,
      resolutionRate,
      punctualityRate,
      avgResolutionHours,
      rawScore,
    });
  }

  const activeTechRawScores = rawTechData
    .filter((t) => t.stat.resolvedCount > 0)
    .map((t) => t.rawScore);

  const techGroupAverage = calculateGroupAverageQuality(
    activeTechRawScores,
    PERFORMANCE_CONFIG.technicians.defaultPriorQuality,
  );

  const techMetrics: TechnicianPerformanceMetric[] = rawTechData.map((item) => {
    const isEligibleForPodium =
      item.stat.resolvedCount >= PERFORMANCE_CONFIG.technicians.minTicketsForPodium;

    const score =
      item.stat.resolvedCount > 0
        ? calculateBayesianScore({
            volume: item.stat.resolvedCount,
            minVolumeConfidence: PERFORMANCE_CONFIG.technicians.minVolumeConfidence,
            rawQuality: item.rawScore,
            groupAverageQuality: techGroupAverage,
          })
        : 0;

    return {
      employeeId: item.employeeId,
      name: item.stat.name,
      totalAssigned: item.stat.totalAssigned,
      resolvedCount: item.stat.resolvedCount,
      pendingCount: item.stat.pendingCount,
      resolutionRate: item.resolutionRate,
      avgResolutionHours: item.avgResolutionHours,
      punctualityRate: item.punctualityRate,
      score,
      rawScore: item.rawScore,
      isEligibleForPodium,
      rank: 0,
    };
  });

  // Ordenar técnicos por puntaje bayesiano descendente, luego volumen
  techMetrics.sort((a, b) => b.score - a.score || b.resolvedCount - a.resolvedCount);

  let eligibleTechPodiumCount = 0;
  techMetrics.forEach((item, index) => {
    item.rank = index + 1;
    if (item.resolvedCount > 0 && item.isEligibleForPodium) {
      if (eligibleTechPodiumCount === 0) item.badge = "gold";
      else if (eligibleTechPodiumCount === 1) item.badge = "silver";
      else if (eligibleTechPodiumCount === 2) item.badge = "bronze";
      eligibleTechPodiumCount += 1;
    } else {
      item.badge = null;
    }
  });

  // Calculate summary metrics
  const totalConversationsResolved = history.length;
  const totalTicketsAssigned = casos.length;
  const totalTicketsResolved = casos.filter((c) => c.status === "done").length;
  const technicianResolutionRate =
    totalTicketsAssigned > 0
      ? Math.round((totalTicketsResolved / totalTicketsAssigned) * 100)
      : 0;

  const totalAgentDuration = agentMetrics.reduce(
    (acc, a) => acc + a.avgDurationMinutes * a.resolvedCases,
    0,
  );
  const avgAgentDurationMinutes =
    totalConversationsResolved > 0
      ? Math.round(totalAgentDuration / totalConversationsResolved)
      : 0;

  const totalFcr = agentMetrics.reduce((acc, a) => acc + a.fcrRate * a.resolvedCases, 0);
  const agentFcrRate =
    totalConversationsResolved > 0
      ? Math.round(totalFcr / totalConversationsResolved)
      : 100;

  // El Podio #1 exige haber alcanzado el umbral de volumen mínimo de elegibilidad
  const bestAgent =
    agentMetrics.find((a) => a.isEligibleForPodium && a.resolvedCases > 0) ?? null;

  const bestTechnician =
    techMetrics.find((t) => t.isEligibleForPodium && t.resolvedCount > 0) ?? null;

  return {
    period,
    dateRange,
    summary: {
      totalConversationsResolved,
      avgAgentDurationMinutes,
      agentFcrRate,
      totalTicketsAssigned,
      totalTicketsResolved,
      technicianResolutionRate,
    },
    bestAgent,
    bestTechnician,
    agents: agentMetrics,
    technicians: techMetrics,
  };
};
