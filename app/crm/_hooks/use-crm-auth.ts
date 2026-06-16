"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AGENT_STATUSES, CRM_STORAGE_KEY } from "../_lib/constants";
import { crmService } from "../_lib/crm-service";
import type { Agent, AgentStatus } from "../_lib/types";

export const useCrmAuth = () => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CRM_STORAGE_KEY);
    if (stored) {
      setAgent(JSON.parse(stored) as Agent);
    }
    setIsLoading(false);
  }, []);

  const persistAgent = (nextAgent: Agent | null) => {
    setAgent(nextAgent);
    if (!nextAgent) {
      window.localStorage.removeItem(CRM_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(nextAgent));
  };

  const login = async (email: string, password: string) => {
    setIsSubmitting(true);
    try {
      const loggedAgent = await crmService.loginAgent(email, password);
      persistAgent(loggedAgent);
      toast.success("Acceso correcto");
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Correo o contraseña incorrectos";
      toast.error(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    if (agent) {
      await crmService.updateAgentStatus(agent.id, "offline").catch(() => undefined);
    }
    persistAgent(null);
  };

  const updateStatus = async () => {
    if (!agent) return;

    const currentIndex = AGENT_STATUSES.indexOf(agent.status);
    const nextStatus: AgentStatus =
      AGENT_STATUSES[(currentIndex + 1) % AGENT_STATUSES.length] || "online";

    await crmService.updateAgentStatus(agent.id, nextStatus);
    const nextAgent = { ...agent, status: nextStatus };
    persistAgent(nextAgent);
    toast.info(`Estado actualizado: ${nextStatus}`);
  };

  const replaceAgent = (nextAgent: Agent) => persistAgent(nextAgent);

  return {
    agent,
    isLoading,
    isSubmitting,
    login,
    logout,
    updateStatus,
    replaceAgent,
  };
};
