import type { SupabaseClient } from "@supabase/supabase-js";

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
  score: number; // 0 - 100
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
  score: number; // 0 - 100
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
 * Calculates weighted score (0 - 100) for office agents:
 * - Satisfaction / First Contact Resolution: 40% weight
 * - Volume of resolved cases: 35% weight
 * - Resolution speed / duration: 25% weight
 */
export const calculateAgentScore = (params: {
  resolvedCases: number;
  maxCasesInPeriod: number;
  fcrRate: number;
  avgDurationMinutes: number;
}): number => {
  if (params.resolvedCases === 0) return 0;

  // FCR score (0 - 100)
  const satisfactionScore = Math.max(0, Math.min(100, params.fcrRate));

  // Volume score normalized against the top performer (or minimum 10 cases)
  const targetMax = Math.max(1, params.maxCasesInPeriod);
  const volumeScore = Math.min(100, (params.resolvedCases / targetMax) * 100);

  // Speed score: <= 15 min = 100 pts, decays down to 30 pts for > 2 hours
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

  const weighted =
    satisfactionScore * 0.4 + volumeScore * 0.35 + speedScore * 0.25;

  return Math.round(weighted * 10) / 10;
};

/**
 * Calculates weighted score (0 - 100) for field technicians:
 * - Resolution rate (Done / Assigned): 45% weight
 * - Punctuality / Schedule adherence: 30% weight
 * - Volume of resolved tickets: 25% weight
 */
export const calculateTechnicianScore = (params: {
  totalAssigned: number;
  resolvedCount: number;
  maxResolvedInPeriod: number;
  resolutionRate: number;
  punctualityRate: number;
}): number => {
  if (params.totalAssigned === 0 || params.resolvedCount === 0) return 0;

  const resolutionScore = Math.max(0, Math.min(100, params.resolutionRate));
  const punctualityScore = Math.max(0, Math.min(100, params.punctualityRate));

  const targetMax = Math.max(1, params.maxResolvedInPeriod);
  const volumeScore = Math.min(100, (params.resolvedCount / targetMax) * 100);

  const weighted =
    resolutionScore * 0.45 + punctualityScore * 0.3 + volumeScore * 0.25;

  return Math.round(weighted * 10) / 10;
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

  for (const stat of agentStatsMap.values()) {
    if (stat.resolvedCases > maxAgentCases) {
      maxAgentCases = stat.resolvedCases;
    }
  }

  const agentMetrics: AgentPerformanceMetric[] = agents.map((agent) => {
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

    // 1 to 5 scale
    const satisfactionRating =
      Math.round((1 + (fcrRate / 100) * 4) * 10) / 10;

    const score = calculateAgentScore({
      resolvedCases: stat.resolvedCases,
      maxCasesInPeriod: maxAgentCases,
      fcrRate,
      avgDurationMinutes,
    });

    return {
      agentId: agent.id,
      name: agent.name,
      email: agent.email,
      initials: agent.initials,
      avatarColor: agent.avatar_color,
      avatarBg: agent.avatar_bg,
      resolvedCases: stat.resolvedCases,
      avgDurationMinutes,
      reopenedCases: stat.reopenedCases,
      fcrRate,
      satisfactionRating,
      score,
      rank: 0,
    };
  });

  // Sort agents by score descending, then resolved cases
  agentMetrics.sort((a, b) => b.score - a.score || b.resolvedCases - a.resolvedCases);
  agentMetrics.forEach((item, index) => {
    item.rank = index + 1;
    if (item.resolvedCases > 0) {
      if (index === 0) item.badge = "gold";
      else if (index === 1) item.badge = "silver";
      else if (index === 2) item.badge = "bronze";
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

  let maxTechResolved = 0;
  for (const stat of techStatsMap.values()) {
    if (stat.resolvedCount > maxTechResolved) {
      maxTechResolved = stat.resolvedCount;
    }
  }

  const techMetrics: TechnicianPerformanceMetric[] = [];
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

    const score = calculateTechnicianScore({
      totalAssigned: stat.totalAssigned,
      resolvedCount: stat.resolvedCount,
      maxResolvedInPeriod: maxTechResolved,
      resolutionRate,
      punctualityRate,
    });

    techMetrics.push({
      employeeId,
      name: stat.name,
      totalAssigned: stat.totalAssigned,
      resolvedCount: stat.resolvedCount,
      pendingCount: stat.pendingCount,
      resolutionRate,
      avgResolutionHours,
      punctualityRate,
      score,
      rank: 0,
    });
  }

  // Sort technicians by score descending, then resolved count
  techMetrics.sort((a, b) => b.score - a.score || b.resolvedCount - a.resolvedCount);
  techMetrics.forEach((item, index) => {
    item.rank = index + 1;
    if (item.resolvedCount > 0) {
      if (index === 0) item.badge = "gold";
      else if (index === 1) item.badge = "silver";
      else if (index === 2) item.badge = "bronze";
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

  const bestAgent =
    agentMetrics.length > 0 && agentMetrics[0].resolvedCases > 0
      ? agentMetrics[0]
      : null;

  const bestTechnician =
    techMetrics.length > 0 && techMetrics[0].resolvedCount > 0
      ? techMetrics[0]
      : null;

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
