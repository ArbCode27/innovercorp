"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { crmService } from "../_lib/crm-service";
import { groupHistoryByResolvedDate } from "../_lib/history-utils";
import {
  HISTORY_PAGE_SIZE,
  addDaysYmd,
  caracasTodayYmd,
} from "../_lib/history-query";
import type { Agent, ConversationHistory, HistoryMessage, Label } from "../_lib/types";

const SEARCH_DEBOUNCE_MS = 350;

type MessagePageState = {
  messages: HistoryMessage[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingOlder: boolean;
};

export const useConversationHistory = (agents: Agent[], labels: Label[]) => {
  const [entries, setEntries] = useState<ConversationHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [messagesById, setMessagesById] = useState<Record<number, MessagePageState>>({});
  const requestSeq = useRef(0);
  const isFirstLoad = useRef(true);
  const messagesByIdRef = useRef(messagesById);
  const searchTermRef = useRef(searchTerm);
  messagesByIdRef.current = messagesById;
  searchTermRef.current = searchTerm;

  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );

  const labelsById = useMemo(
    () => new Map(labels.map((label) => [label.id, label])),
    [labels],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next !== searchTermRef.current) {
        setOffset(0);
      }
      setSearchTerm(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadHistory = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (isFirstLoad.current) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await crmService.loadConversationHistory({
        limit: HISTORY_PAGE_SIZE,
        offset,
        from: from || null,
        to: to || null,
        q: searchTerm || null,
      });
      if (seq !== requestSeq.current) return;
      setEntries(data.entries);
      setTotal(data.total);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      console.error("Load conversation history:", error);
      toast.error("No se pudo cargar el historial de conversaciones");
    } finally {
      if (seq === requestSeq.current) {
        isFirstLoad.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [from, offset, searchTerm, to]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const loadMessages = useCallback(async (historyId: number) => {
    setMessagesById((current) => {
      const existing = current[historyId];
      if (existing?.messages.length) return current;
      return {
        ...current,
        [historyId]: {
          messages: existing?.messages || [],
          hasMore: existing?.hasMore ?? false,
          isLoading: true,
          isLoadingOlder: false,
        },
      };
    });

    try {
      const data = await crmService.loadHistoryMessages(historyId);
      setMessagesById((current) => ({
        ...current,
        [historyId]: {
          messages: data.messages,
          hasMore: data.hasMore,
          isLoading: false,
          isLoadingOlder: false,
        },
      }));
    } catch (error) {
      console.error("Load history messages:", error);
      toast.error("No se pudieron cargar los mensajes de esta conversación");
      setMessagesById((current) => ({
        ...current,
        [historyId]: {
          messages: current[historyId]?.messages || [],
          hasMore: current[historyId]?.hasMore ?? false,
          isLoading: false,
          isLoadingOlder: false,
        },
      }));
    }
  }, []);

  const loadOlderMessages = useCallback(async (historyId: number) => {
    const current = messagesByIdRef.current[historyId];
    if (!current?.hasMore || current.isLoadingOlder || !current.messages.length) {
      return;
    }

    const oldest = current.messages[0];
    setMessagesById((state) => ({
      ...state,
      [historyId]: { ...state[historyId], isLoadingOlder: true },
    }));

    try {
      const data = await crmService.loadHistoryMessages(historyId, {
        before: oldest.created_at,
      });
      setMessagesById((state) => {
        const prev = state[historyId];
        const existingIds = new Set((prev?.messages || []).map((item) => item.id));
        const prepended = data.messages.filter((item) => !existingIds.has(item.id));
        return {
          ...state,
          [historyId]: {
            messages: [...prepended, ...(prev?.messages || [])],
            hasMore: data.hasMore,
            isLoading: false,
            isLoadingOlder: false,
          },
        };
      });
    } catch (error) {
      console.error("Load older history messages:", error);
      toast.error("No se pudieron cargar mensajes anteriores");
      setMessagesById((state) => ({
        ...state,
        [historyId]: { ...state[historyId], isLoadingOlder: false },
      }));
    }
  }, []);

  const groupedEntries = useMemo(
    () => groupHistoryByResolvedDate(entries),
    [entries],
  );

  const selectedCache = useRef<ConversationHistory | null>(null);

  const selectedFromPage = useMemo(
    () => entries.find((entry) => entry.id === selectedHistoryId) ?? null,
    [entries, selectedHistoryId],
  );

  if (selectedFromPage) {
    selectedCache.current = selectedFromPage;
  }

  const selectedEntry =
    selectedHistoryId === null
      ? null
      : selectedFromPage || selectedCache.current;

  const selectedMessages = selectedHistoryId
    ? messagesById[selectedHistoryId] || null
    : null;

  const selectHistoryEntry = useCallback<(id: number | null) => void>((id) => {
    setSelectedHistoryId(id);
    if (!id) {
      selectedCache.current = null;
      return;
    }
    const match = entries.find((entry) => entry.id === id) || selectedCache.current;
    if (match && match.id === id) selectedCache.current = match;
    void loadMessages(id);
  }, [entries, loadMessages]);

  const clearSelectedHistory = useCallback(() => {
    setSelectedHistoryId(null);
    selectedCache.current = null;
  }, []);

  const applyDateRange = useCallback((nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setOffset(0);
  }, []);

  const applyPreset = useCallback((preset: "today" | "7d" | "30d" | "all") => {
    const today = caracasTodayYmd();
    if (preset === "all") {
      applyDateRange("", "");
      return;
    }
    if (preset === "today") {
      applyDateRange(today, today);
      return;
    }
    const days = preset === "7d" ? -6 : -29;
    applyDateRange(addDaysYmd(today, days), today);
  }, [applyDateRange]);

  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const page = Math.floor(offset / HISTORY_PAGE_SIZE) + 1;
  const canPrev = offset > 0;
  const canNext = offset + HISTORY_PAGE_SIZE < total;

  const goPrev = useCallback(() => {
    setOffset((current) => Math.max(0, current - HISTORY_PAGE_SIZE));
  }, []);

  const goNext = useCallback(() => {
    setOffset((current) => current + HISTORY_PAGE_SIZE);
  }, []);

  return {
    entries,
    groupedEntries,
    selectedEntry,
    selectedHistoryId,
    selectedMessages,
    isLoading,
    isRefreshing,
    searchTerm: searchInput,
    from,
    to,
    total,
    page,
    pageCount,
    pageSize: HISTORY_PAGE_SIZE,
    canPrev,
    canNext,
    agentsById,
    labelsById,
    setSearchTerm: setSearchInput,
    applyDateRange,
    applyPreset,
    goPrev,
    goNext,
    selectHistoryEntry,
    clearSelectedHistory,
    loadOlderMessages,
    reloadHistory: loadHistory,
  };
};
