"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, TicketPlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { CRM_DIALOG, CRM_SURFACES } from "../../_lib/crm-theme";
import { CrmButton } from "../shared/crm-button";
import {
  humanizeReporteKey,
  parseReporte,
  reporteToPlainDescription,
  suggestCategoryId,
} from "@/lib/parseReporte";
import type {
  ResultadoCaso,
  WisproCategory,
  WisproClientHit,
  WisproContractHit,
  WisproEmployee,
} from "@/lib/wispro-types";
import {
  createCasoSchema,
  orderKindLabels,
  ORDER_KINDS,
} from "../../_lib/wispro-caso-schema";
import type { z } from "zod";
import { collectCasoContextFromMessages } from "@/lib/caso-chat-context";
import { buildMapsUrl, extractMapsUrl, parseCoordsFromMapsUrl } from "@/lib/maps-link";
import type { Message } from "../../_lib/types";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import { ResultadoCasoPanel } from "./resultado-caso-panel";

const storageKey = (publicId: number | string) => `wispro-caso:${publicId}`;

const toDatetimeLocal = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultWindow = () => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return {
    startAt: toDatetimeLocal(start),
    endAt: toDatetimeLocal(end),
  };
};

const toIso = (localValue: string) => {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? localValue : date.toISOString();
};

const findLatestAiReport = (messages: Array<{ type?: string; content?: string | null }>) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = String(messages[index]?.content || "");
    if (messages[index]?.type !== "out") continue;
    if (/reporte técnico|[•\-\*]\s*\*?\*?motivo/i.test(content)) return content;
  }
  return "";
};

type FormValues = z.input<typeof createCasoSchema>;

interface CrearCasoWisproDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: number | null;
  crmClientId?: number | null;
  wisproClientId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  messages?: Message[];
}

export const CrearCasoWisproDialog = ({
  open,
  onOpenChange,
  conversationId = null,
  crmClientId = null,
  wisproClientId,
  clientName,
  clientPhone,
  messages = [],
}: CrearCasoWisproDialogProps) => {
  const defaults = defaultWindow();
  const [reporte, setReporte] = useState("");
  const [parsed, setParsed] = useState<Record<string, string>>({});
  const [suggestedCategory, setSuggestedCategory] = useState(false);
  const [categories, setCategories] = useState<WisproCategory[]>([]);
  const [employees, setEmployees] = useState<WisproEmployee[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [chatImages, setChatImages] = useState<
    Array<{ messageId: number | null; mediaUrl: string; caption: string | null }>
  >([]);
  const [clientQuery, setClientQuery] = useState("");
  const [clientHits, setClientHits] = useState<WisproClientHit[]>([]);
  const [selectedClient, setSelectedClient] = useState<WisproClientHit | null>(null);
  const [contracts, setContracts] = useState<WisproContractHit[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<ResultadoCaso | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openSections, setOpenSections] = useState({
    cliente: true,
    ticket: true,
    orden: true,
    ubicacion: true,
    tecnico: true,
  });
  const lastPayloadRef = useRef<z.output<typeof createCasoSchema> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(createCasoSchema),
    defaultValues: {
      title: "",
      description: "",
      categoryId: "",
      clientId: wisproClientId || "",
      contractId: "",
      assignableId: "",
      generateOrder: true,
      kind: "technical",
      orderDescription: "",
      startAt: defaults.startAt,
      endAt: defaults.endAt,
      employeeId: "",
      gps: null,
      conversationId,
      crmClientId,
      clientName: clientName || "",
      clientPhone: clientPhone || "",
      cause: "",
      mapsUrl: "",
      addressText: "",
      facadeMediaUrl: "",
      facadeMessageId: null,
    },
  });

  const generateOrder = form.watch("generateOrder");
  const categoryId = form.watch("categoryId");
  const contractId = form.watch("contractId");
  const employeeId = form.watch("employeeId");
  const kind = form.watch("kind");
  const title = form.watch("title");
  const startAt = form.watch("startAt");
  const endAt = form.watch("endAt");
  const mapsUrl = form.watch("mapsUrl");
  const facadeMediaUrl = form.watch("facadeMediaUrl");

  const highCategories = categories.filter((item) => item.level === "High");
  const lowCategories = categories.filter((item) => item.level !== "High");
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedEmployee = employees.find((item) => item.id === employeeId);
  const selectedContract = contracts.find((item) => item.id === contractId);

  const loadCatalog = async (refresh = false) => {
    setIsLoadingCatalog(true);
    try {
      const catalog = await wisproCasoClient.loadCatalog({
        refresh,
        allEmployees: true,
      });
      setCategories(catalog.categories);
      setEmployees(catalog.employees);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "No se cargó el catálogo Wispro",
      );
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const seed = findLatestAiReport(messages);
    const chatCtx = collectCasoContextFromMessages(messages, seed);
    setReporte(seed);
    setParsed(seed ? parseReporte(seed) : {});
    setSuggestedCategory(false);
    setResult(null);
    setConfirmOpen(false);
    setChatImages(chatCtx.images);
    void loadCatalog(false);
    const gpsFromChat =
      chatCtx.latitude != null && chatCtx.longitude != null
        ? {
            street: "",
            number: "",
            city: "",
            state: "",
            countryCode: "VE",
            latitude: chatCtx.latitude,
            longitude: chatCtx.longitude,
          }
        : null;
    form.reset({
      ...form.getValues(),
      clientId: wisproClientId || "",
      startAt: defaults.startAt,
      endAt: defaults.endAt,
      generateOrder: true,
      kind: "technical",
      conversationId,
      crmClientId,
      clientName: clientName || "",
      clientPhone: clientPhone || "",
      mapsUrl: chatCtx.mapsUrl || "",
      addressText: chatCtx.addressText || "",
      facadeMediaUrl: chatCtx.facade?.mediaUrl || "",
      facadeMessageId: chatCtx.facade?.messageId,
      gps: gpsFromChat,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wisproClientId, conversationId, crmClientId]);

  useEffect(() => {
    if (!open || !wisproClientId) return;
    let cancelled = false;
    const hydrateClient = async () => {
      try {
        const client = await wisproCasoClient.getClient(wisproClientId);
        if (cancelled || !client) return;
        setSelectedClient(client);
        setClientQuery(client.name);
        form.setValue("clientId", client.id, { shouldDirty: false });
        const nextContracts = await wisproCasoClient.listContracts(client.id);
        if (cancelled) return;
        setContracts(nextContracts);
        if (nextContracts.length === 1 && nextContracts[0]) {
          form.setValue("contractId", nextContracts[0].id, { shouldDirty: false });
          applyContractGps(nextContracts[0]);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "No se cargó el cliente Wispro",
          );
        }
      }
    };
    void hydrateClient();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wisproClientId]);

  useEffect(() => {
    if (clientQuery.trim().length < 2 || selectedClient?.name === clientQuery) {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsSearchingClients(true);
      void wisproCasoClient
        .searchClients(clientQuery)
        .then(setClientHits)
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : "Error al buscar clientes",
          );
        })
        .finally(() => setIsSearchingClients(false));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [clientQuery, selectedClient?.name]);

  const applyContractGps = (contract: WisproContractHit) => {
    if (form.getValues("mapsUrl") || form.getValues("gps")) return;
    if (contract.latitude == null || contract.longitude == null) return;
    form.setValue(
      "gps",
      {
        street: contract.street,
        number: contract.number,
        city: contract.city,
        state: contract.state_name,
        countryCode: contract.country_code || "VE",
        latitude: contract.latitude,
        longitude: contract.longitude,
      },
      { shouldDirty: false },
    );
    if (!form.getValues("mapsUrl")) {
      form.setValue(
        "mapsUrl",
        buildMapsUrl({
          latitude: contract.latitude,
          longitude: contract.longitude,
        }),
        { shouldDirty: false },
      );
    }
    if (!form.getValues("addressText")) {
      const address = [contract.street, contract.number, contract.city]
        .filter(Boolean)
        .join(" ");
      if (address) {
        form.setValue("addressText", address, { shouldDirty: false });
      }
    }
  };

  const handleExtract = () => {
    const nextParsed = parseReporte(reporte);
    setParsed(nextParsed);
    const dirty = form.formState.dirtyFields;

    if (!dirty.title) {
      const titleValue = (nextParsed.motivo || "").slice(0, 80);
      form.setValue("title", titleValue, { shouldDirty: false, shouldValidate: true });
    }
    if (!dirty.description) {
      form.setValue("description", reporteToPlainDescription(reporte), {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
    if (!dirty.orderDescription) {
      const orderText = [nextParsed.posible_causa, nextParsed.zona_opt]
        .filter(Boolean)
        .join(" · ");
      if (orderText) {
        form.setValue("orderDescription", orderText, { shouldDirty: false });
      }
    }
    if (!dirty.categoryId) {
      const suggested = suggestCategoryId(nextParsed, categories);
      if (suggested) {
        form.setValue("categoryId", suggested, { shouldDirty: false });
        setSuggestedCategory(true);
      }
    }
    if (!dirty.cause && nextParsed.posible_causa) {
      form.setValue("cause", nextParsed.posible_causa, { shouldDirty: false });
    }
    const reporteMaps = extractMapsUrl(reporte);
    if (reporteMaps && !form.getValues("mapsUrl")) {
      form.setValue("mapsUrl", reporteMaps, { shouldDirty: false });
      const coords = parseCoordsFromMapsUrl(reporteMaps);
      if (coords && !form.getValues("gps")) {
        form.setValue(
          "gps",
          {
            street: "",
            number: "",
            city: "",
            state: "",
            countryCode: "VE",
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
          { shouldDirty: false },
        );
      }
    }
  };

  const handleSelectClient = async (client: WisproClientHit) => {
    setSelectedClient(client);
    setClientQuery(client.name);
    setClientHits([]);
    form.setValue("clientId", client.id, { shouldDirty: true });
    const nextContracts = await wisproCasoClient.listContracts(client.id);
    setContracts(nextContracts);
    if (nextContracts.length === 1 && nextContracts[0]) {
      form.setValue("contractId", nextContracts[0].id, { shouldDirty: true });
      applyContractGps(nextContracts[0]);
    } else {
      form.setValue("contractId", "", { shouldDirty: true });
    }
  };

  const persistResult = (next: ResultadoCaso, payload: z.output<typeof createCasoSchema>) => {
    setResult(next);
    lastPayloadRef.current = payload;
    if (next.ticket.ok && next.ticket.publicId != null) {
      sessionStorage.setItem(
        storageKey(next.ticket.publicId),
        JSON.stringify({
          result: next,
          payload,
        }),
      );
    }
  };

  const submitCaso = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const parsedValues = createCasoSchema.parse(values);
      const payload = {
        ...parsedValues,
        startAt: toIso(values.startAt || "") || parsedValues.startAt,
        endAt: toIso(values.endAt || "") || parsedValues.endAt,
        conversationId: conversationId || parsedValues.conversationId,
        crmClientId: crmClientId || parsedValues.crmClientId,
        clientName: clientName || parsedValues.clientName,
        clientPhone: clientPhone || parsedValues.clientPhone,
        gps:
          parsedValues.gps &&
          Number.isFinite(Number(parsedValues.gps.latitude)) &&
          Number.isFinite(Number(parsedValues.gps.longitude))
            ? parsedValues.gps
            : null,
      };
      const next = await wisproCasoClient.createCaso(payload);
      persistResult(next, payload);
      if (next.ticket.ok && next.orden.ok !== false && next.tecnico.ok !== false) {
        toast.success("Caso creado en Wispro");
      } else if (next.ticket.ok) {
        toast.warning("El ticket se creó, pero hubo un fallo parcial");
      } else {
        toast.error(next.ticket.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el caso");
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleRetryFailed = async () => {
    const payload = lastPayloadRef.current;
    if (!result?.ticket.ok || !payload) return;
    setIsSubmitting(true);
    try {
      const next = await wisproCasoClient.retryCaso({
        ticketId: result.ticket.id,
        publicId: result.ticket.publicId,
        generateOrder: payload.generateOrder,
        existingOrderId: result.orden.ok ? result.orden.id : null,
        kind: payload.kind,
        orderDescription: payload.orderDescription,
        startAt: payload.startAt,
        endAt: payload.endAt,
        contractId: payload.contractId,
        employeeId: payload.employeeId,
        gps: payload.gps,
        conversationId: payload.conversationId,
        crmClientId: payload.crmClientId,
        clientName: payload.clientName,
        clientPhone: payload.clientPhone,
        cause: payload.cause,
        mapsUrl: payload.mapsUrl,
        addressText: payload.addressText,
        facadeMediaUrl: payload.facadeMediaUrl,
        facadeMessageId: payload.facadeMessageId,
      });
      persistResult(next, payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reintentar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const missingMotivo = Boolean(reporte.trim()) && !parsed.motivo && !title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${CRM_DIALOG} flex max-h-[92vh] w-[min(96vw,72rem)] max-w-6xl flex-col overflow-hidden sm:max-w-6xl`}>
        <DialogHeader>
          <DialogTitle>Crear ticket y orden en Wispro</DialogTitle>
          <DialogDescription className={CRM_SURFACES.textMuted}>
            Se crea desde este chat. El número público del ticket es el que le pasás al cliente.
            {clientName ? ` Cliente CRM: ${clientName}.` : ""}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ResultadoCasoPanel
              result={result}
              onRetryFailed={() => void handleRetryFailed()}
              isRetrying={isSubmitting}
            />
          </div>
        ) : (
          <form
            className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2"
            onSubmit={form.handleSubmit(
              () => setConfirmOpen(true),
              () =>
                toast.error(
                  "Completá título, descripción y categoría antes de crear",
                ),
            )}>
            <section className="space-y-3">
              <h3 className={`text-sm font-semibold ${CRM_SURFACES.textPrimary}`}>
                Resumen del agente IA
              </h3>
              <Textarea
                value={reporte}
                onChange={(event) => setReporte(event.target.value)}
                className={`min-h-64 font-mono text-xs ${CRM_SURFACES.input}`}
                placeholder="Pegá el reporte técnico que generó Nova..."
              />
              <CrmButton type="button" variant="secondary" onClick={handleExtract}>
                <Wand2 className="size-4" />
                Extraer datos
              </CrmButton>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(parsed).length ? (
                  Object.entries(parsed).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="max-w-full font-normal">
                      <span className="font-medium">{humanizeReporteKey(key)}:</span>{" "}
                      <span className="truncate">{value}</span>
                    </Badge>
                  ))
                ) : (
                  <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                    Todavía no se detectaron campos. Extraé datos o completalos a mano.
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              {catalogError ? (
                <p className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
                  {catalogError}. El botón de crear queda deshabilitado hasta refrescar el catálogo.
                </p>
              ) : null}

              <CollapsibleBlock
                title="Cliente y contrato"
                open={openSections.cliente}
                onToggle={() => toggleSection("cliente")}>
                <Label htmlFor="wispro-client-search">Buscar en Wispro</Label>
                <Input
                  id="wispro-client-search"
                  value={clientQuery}
                  onChange={(event) => {
                    setClientQuery(event.target.value);
                    setSelectedClient(null);
                  }}
                  placeholder="Nombre o cédula"
                  className={CRM_SURFACES.input}
                />
                {isSearchingClients ? (
                  <p className={`text-xs ${CRM_SURFACES.textMuted}`}>Buscando...</p>
                ) : null}
                {clientHits.length ? (
                  <ul className="max-h-36 space-y-1 overflow-y-auto">
                    {clientHits.map((client) => (
                      <li key={client.id}>
                        <button
                          type="button"
                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${CRM_SURFACES.border} ${CRM_SURFACES.hover}`}
                          onClick={() => void handleSelectClient(client)}>
                          <span className={CRM_SURFACES.textPrimary}>{client.name}</span>
                          <span className={`mt-0.5 block font-mono text-[11px] ${CRM_SURFACES.textMuted}`}>
                            {client.id}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {selectedClient ? (
                  <p className={`font-mono text-[11px] ${CRM_SURFACES.textMuted}`}>
                    client_id: {selectedClient.id}
                    {selectedClient.national_identification_number
                      ? ` · doc ${selectedClient.national_identification_number}`
                      : ""}
                  </p>
                ) : null}
                {contracts.length > 0 ? (
                  <div className="space-y-1">
                    <Label>Contrato</Label>
                    <Select
                      value={contractId || ""}
                      onValueChange={(value) => {
                        form.setValue("contractId", value, { shouldDirty: true });
                        const contract = contracts.find((item) => item.id === value);
                        if (contract) applyContractGps(contract);
                      }}>
                      <SelectTrigger className={CRM_SURFACES.input}>
                        <SelectValue placeholder="Selecciona un contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts.map((contract) => (
                          <SelectItem key={contract.id} value={contract.id}>
                            {contract.plan_name || "Contrato"} · {contract.state || "sin estado"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedContract ? (
                      <p className={`font-mono text-[11px] ${CRM_SURFACES.textMuted}`}>
                        contract_id: {selectedContract.id}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CollapsibleBlock>

              <CollapsibleBlock
                title="Ticket"
                open={openSections.ticket}
                onToggle={() => toggleSection("ticket")}>
                <div className="space-y-1">
                  <Label htmlFor="caso-title">Título</Label>
                  <Input
                    id="caso-title"
                    maxLength={80}
                    className={`${CRM_SURFACES.input} ${missingMotivo ? "border-red-400" : ""}`}
                    {...form.register("title")}
                  />
                  {missingMotivo ? (
                    <p className="text-xs text-red-600">
                      No se detectó Motivo. Completá el título a mano.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="caso-description">Descripción</Label>
                  <Textarea
                    id="caso-description"
                    className={`min-h-28 ${CRM_SURFACES.input}`}
                    {...form.register("description")}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label>Categoría</Label>
                    <CrmButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadCatalog(true)}
                      disabled={isLoadingCatalog}>
                      Refrescar
                    </CrmButton>
                    {suggestedCategory ? (
                      <span className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                        sugerida automáticamente
                      </span>
                    ) : null}
                  </div>
                  <Select
                    value={categoryId || ""}
                    onValueChange={(value) => {
                      form.setValue("categoryId", value, { shouldDirty: true });
                      setSuggestedCategory(false);
                    }}>
                    <SelectTrigger className={CRM_SURFACES.input}>
                      <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {highCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                      {lowCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {`  ${category.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleBlock>

              <CollapsibleBlock
                title="Orden"
                open={openSections.orden}
                onToggle={() => toggleSection("orden")}>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="generate-order">Generar orden de trabajo</Label>
                  <Switch
                    id="generate-order"
                    checked={generateOrder}
                    onCheckedChange={(checked) =>
                      form.setValue("generateOrder", checked, { shouldDirty: true })
                    }
                  />
                </div>
                {generateOrder ? (
                  <>
                    <Select
                      value={kind}
                      onValueChange={(value) =>
                        form.setValue("kind", value as FormValues["kind"], {
                          shouldDirty: true,
                        })
                      }>
                      <SelectTrigger className={CRM_SURFACES.input}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_KINDS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {orderKindLabels[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      className={`min-h-20 ${CRM_SURFACES.input}`}
                      placeholder="Descripción de la orden"
                      {...form.register("orderDescription")}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="start-at">Inicio</Label>
                        <Input
                          id="start-at"
                          type="datetime-local"
                          className={CRM_SURFACES.input}
                          {...form.register("startAt")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="end-at">Fin</Label>
                        <Input
                          id="end-at"
                          type="datetime-local"
                          className={CRM_SURFACES.input}
                          {...form.register("endAt")}
                        />
                      </div>
                    </div>
                    {selectedContract?.latitude != null &&
                    selectedContract.longitude != null ? (
                      <p className={`font-mono text-[11px] ${CRM_SURFACES.textMuted}`}>
                        GPS contrato: {selectedContract.latitude}, {selectedContract.longitude}
                        {selectedContract.city ? ` · ${selectedContract.city}` : ""}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </CollapsibleBlock>

              <CollapsibleBlock
                title="Ubicación y fachada"
                open={openSections.ubicacion}
                onToggle={() => toggleSection("ubicacion")}>
                <Label htmlFor="caso-maps">Link de Google Maps</Label>
                <Input
                  id="caso-maps"
                  value={mapsUrl || ""}
                  onChange={(event) => {
                    const next = event.target.value;
                    form.setValue("mapsUrl", next, { shouldDirty: true });
                    const coords = parseCoordsFromMapsUrl(next);
                    if (coords) {
                      form.setValue(
                        "gps",
                        {
                          ...(form.getValues("gps") || {}),
                          countryCode: "VE",
                          latitude: coords.latitude,
                          longitude: coords.longitude,
                        },
                        { shouldDirty: true },
                      );
                    }
                  }}
                  placeholder="https://maps.app.goo.gl/... o pin del chat"
                  className={CRM_SURFACES.input}
                />
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline">
                    Abrir Maps
                  </a>
                ) : (
                  <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                    Se rellena solo si el cliente mandó pin o un link de Maps.
                  </p>
                )}
                <Label htmlFor="caso-address">Dirección</Label>
                <Input
                  id="caso-address"
                  {...form.register("addressText")}
                  placeholder="Calle, sector, referencia"
                  className={CRM_SURFACES.input}
                />
                <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                  Foto de fachada (se reenvía al técnico con el reporte)
                </p>
                {chatImages.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {chatImages.map((image) => {
                      const selected = image.mediaUrl === facadeMediaUrl;
                      return (
                        <button
                          key={`${image.messageId}-${image.mediaUrl}`}
                          type="button"
                          onClick={() => {
                            form.setValue("facadeMediaUrl", image.mediaUrl, {
                              shouldDirty: true,
                            });
                            form.setValue("facadeMessageId", image.messageId, {
                              shouldDirty: true,
                            });
                          }}
                          aria-label="Elegir foto de fachada"
                          aria-pressed={selected}
                          className={`overflow-hidden rounded-xl border-2 ${
                            selected
                              ? "border-emerald-500"
                              : "border-transparent"
                          }`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.mediaUrl}
                            alt={image.caption || "Foto del chat"}
                            className="h-20 w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                    Este chat no tiene fotos recientes para usar como fachada.
                  </p>
                )}
              </CollapsibleBlock>

              <CollapsibleBlock
                title="Técnico"
                open={openSections.tecnico}
                onToggle={() => toggleSection("tecnico")}>
                <Select
                  value={employeeId || "__none__"}
                  onValueChange={(value) =>
                    form.setValue("employeeId", value === "__none__" ? "" : value, {
                      shouldDirty: true,
                    })
                  }>
                  <SelectTrigger className={CRM_SURFACES.input}>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                        {employee.phone_mobile ? ` · ${employee.phone_mobile}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CollapsibleBlock>

              <CrmButton
                type="submit"
                disabled={Boolean(catalogError) || isLoadingCatalog || isSubmitting}
                className="w-full">
                <TicketPlus className="size-4" />
                Crear ticket y orden
              </CrmButton>
            </section>
          </form>
        )}
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className={CRM_DIALOG}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar creación en Wispro</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className={`space-y-1 text-sm ${CRM_SURFACES.textSecondary}`}>
                <p>Título: {title || "—"}</p>
                <p>Categoría: {selectedCategory?.name || "—"}</p>
                <p>Cliente: {selectedClient?.name || "—"}</p>
                <p>Contrato: {selectedContract?.id || "—"}</p>
                <p>
                  Orden:{" "}
                  {generateOrder
                    ? orderKindLabels[kind ?? "technical"]
                    : "no se crea orden"}
                </p>
                <p>Maps: {mapsUrl || "sin link"}</p>
                <p>Fachada: {facadeMediaUrl ? "sí" : "no"}</p>
                <p>
                  Ventana: {startAt || "—"} → {endAt || "—"}
                </p>
                <p>Técnico: {selectedEmployee?.name || "sin asignar"}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void form.handleSubmit(submitCaso)();
              }}>
              {isSubmitting ? "Creando..." : "Confirmar y crear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

const CollapsibleBlock = ({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <div className={`rounded-2xl border p-3 ${CRM_SURFACES.border}`}>
    <button
      type="button"
      className="flex w-full items-center justify-between text-left text-sm font-medium"
      onClick={onToggle}
      aria-expanded={open}>
      {title}
      <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
    </button>
    {open ? <div className="mt-3 space-y-3">{children}</div> : null}
  </div>
);
