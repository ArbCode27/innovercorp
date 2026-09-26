"use client";

import { useCallback, useEffect, useState } from "react";
import { isOpenCrmCasoStatus } from "@/lib/ticket-chat-link";
import type { CrmWisproCaso } from "@/lib/crm-wispro-casos";
import { wisproCasoClient } from "../_lib/wispro-caso-client";

export const useOpenCrmCasos = (enabled: boolean) => {
  const [openCasos, setOpenCasos] = useState<CrmWisproCaso[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshOpenCasos = useCallback(async () => {
    if (!enabled) {
      setOpenCasos([]);
      return;
    }
    setIsLoading(true);
    try {
      const casos = await wisproCasoClient.listCrmCasos();
      setOpenCasos(casos.filter((caso) => isOpenCrmCasoStatus(caso.status)));
    } catch {
      setOpenCasos([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refreshOpenCasos();
  }, [refreshOpenCasos]);

  return { openCasos, isLoading, refreshOpenCasos };
};
