"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, TicketPlus } from "lucide-react";
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
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { Button } from "@/components/ui/button";
import { humanizeReporteKey, suggestCategoryId } from "@/lib/parseReporte";
import { casoFieldsFromReporte } from "@/lib/caso-from-reporte";
import type {
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
import { buildMapsUrl, parseCoordsFromMapsUrl } from "@/lib/maps-link";
import type { Message } from "../../_lib/types";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import { EmployeePicker } from "./employee-picker";
import { FacadeImageField } from "./facade-image-field";

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
    if (
      /reporte t[eé]cnico|acci[oó]n requerida|google maps|[•\-\*]\s*\*?\*?motivo/i.test(
        content,
      )
    ) {
      return content;
    }
  }
  return "";
};

const gpsFromCoords = (latitude: number | null, longitude: number | null) => {
  if (latitude == null || longitude == null) return null;
  return {
    street: "",
    number: "",
    city: "",
    state: "",
    countryCode: "VE",
    latitude,
    longitude,
  };
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
  onCreated?: () => void;
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
  onCreated,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openSections, setOpenSections] = useState({
    cliente: true,
    ticket: true,
    orden: true,
    ubicacion: true,
    tecnico: true,
  });
  const autoFilledKeyRef = useRef<string | null>(null);
  const latestReport = findLatestAiReport(messages);

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
  const facadeMessageId = form.watch("facadeMessageId");

  const highCategories = categories.filter((item) => item.level === "High");
  const lowCategories = categories.filter((item) => item.level !== "High");
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedEmployee = employees.find((item) => item.id === employeeId);
  const selectedContract = contracts.find((item) => item.id === contractId);

  const loadCatalog = async (refresh = false) => {
    setIsLoadingCatalog(true);
    try {
      const catalog = await wisproCasoClient.loadCatalog({ refresh });
      setCategories(catalog.categories);
      setEmployees(catalog.employees);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "No se cargó el catálogo",
      );
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (!open) {
      autoFilledKeyRef.current = null;
      return;
    }
    const fillKey = `${conversationId ?? "none"}:${crmClientId ?? "none"}:${latestReport}`;
    if (autoFilledKeyRef.current === fillKey) return;
    autoFilledKeyRef.current = fillKey;

    const fromReporte = casoFieldsFromReporte(latestReport);
    const chatCtx = collectCasoContextFromMessages(messages, latestReport);
    setReporte(latestReport);
    setParsed(fromReporte.parsed);
    setSuggestedCategory(false);
    setConfirmOpen(false);
    setChatImages(chatCtx.images);
    void loadCatalog(false);

    const mapsUrlValue = fromReporte.mapsUrl || chatCtx.mapsUrl || "";
    const latitude = fromReporte.latitude ?? chatCtx.latitude;
    const longitude = fromReporte.longitude ?? chatCtx.longitude;
    const addressText = fromReporte.addressText || chatCtx.addressText || "";

    form.reset({
      ...form.getValues(),
      clientId: wisproClientId || "",
      categoryId: "",
      startAt: defaults.startAt,
      endAt: defaults.endAt,
      generateOrder: true,
      kind: "technical",
      conversationId,
      crmClientId,
      clientName: clientName || "",
      clientPhone: clientPhone || "",
      title: fromReporte.title,
      description: fromReporte.description,
      cause: fromReporte.cause || "",
      orderDescription: fromReporte.orderDescription || "",
      mapsUrl: mapsUrlValue,
      addressText,
      facadeMediaUrl: chatCtx.facade?.mediaUrl || "",
      facadeMessageId: chatCtx.facade?.messageId,
      gps: gpsFromCoords(latitude, longitude),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wisproClientId, conversationId, crmClientId, latestReport]);

  useEffect(() => {
    if (!open || !categories.length || !Object.keys(parsed).length) return;
    if (form.getValues("categoryId")) return;
    const suggested = suggestCategoryId(parsed, categories);
    if (!suggested) return;
    form.setValue("categoryId", suggested, { shouldDirty: false });
    setSuggestedCategory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categories, parsed]);

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
            error instanceof Error ? error.message : "No se cargó el cliente",
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
      const compact = clientQuery.replace(/[\s.-]/g, "");
      const digits = compact.replace(/\D/g, "");
      const isDocumentQuery =
        digits.length >= 5 &&
        digits.length <= 12 &&
        /^[VEJGvejg]?\d+$/.test(compact);
      setIsSearchingClients(true);
      void wisproCasoClient
        .searchClients(clientQuery)
        .then((hits) => {
          if (isDocumentQuery && hits.length === 1 && hits[0]) {
            void handleSelectClient(hits[0]);
            return;
          }
          setClientHits(hits);
        })
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : "Error al buscar clientes",
          );
        })
        .finally(() => setIsSearchingClients(false));
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const submitCaso = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const parsedValues = createCasoSchema.parse(values);
      if (!parsedValues.clientId) {
        toast.error("Selecciona un cliente por nombre o cédula");
        return;
      }
      const payload = {
        ...parsedValues,
        startAt: toIso(values.startAt || "") || parsedValues.startAt,
        endAt: toIso(values.endAt || "") || parsedValues.endAt,
        conversationId: conversationId || parsedValues.conversationId,
        crmClientId: crmClientId || parsedValues.crmClientId,
        clientName:
          selectedClient?.name || clientName || parsedValues.clientName,
        clientPhone:
          selectedClient?.phone_mobile ||
          clientPhone ||
          parsedValues.clientPhone,
        gps:
          parsedValues.gps &&
          Number.isFinite(Number(parsedValues.gps.latitude)) &&
          Number.isFinite(Number(parsedValues.gps.longitude))
            ? parsedValues.gps
            : null,
      };
      const next = await wisproCasoClient.createCaso(payload);
      if (!next.ticket.ok) {
        toast.error(next.ticket.error);
        return;
      }

      const publicId = next.ticket.publicId;
      const ticketLabel =
        publicId != null ? `Ticket #${publicId}` : "Ticket creado";

      if (next.orden.ok === false) {
        toast.warning(
          `${ticketLabel}. La orden no se creó: ${next.orden.error}`,
        );
      } else if (next.crm?.ok === false) {
        toast.warning(
          `${ticketLabel}. No se guardó la ficha CRM: ${next.crm.error}`,
        );
      } else {
        const technicianName = selectedEmployee?.name;
        toast.success(
          technicianName
            ? `${ticketLabel}. Técnico asignado: ${technicianName}`
            : ticketLabel,
        );
      }
      onCreated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el caso");
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const missingMotivo = Boolean(reporte.trim()) && !parsed.motivo && !title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex max-h-[92vh] w-[min(96vw,72rem)] max-w-6xl flex-col overflow-hidden sm:max-w-6xl`}>
        <DialogHeader>
          <DialogTitle>Crear ticket</DialogTitle>
          <DialogDescription className={CRM_SURFACES.textMuted}>
            {conversationId
              ? "Se crea desde este chat. El número del ticket es el que se le pasa al cliente."
              : "Busca el cliente por nombre o cédula. El número del ticket es el que se le pasa al cliente."}
            {clientName ? ` Cliente: ${clientName}.` : ""}
          </DialogDescription>
          </DialogHeader>

          <form
            className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2"
            onSubmit={form.handleSubmit(
              () => setConfirmOpen(true),
              () =>
                toast.error(
                  "Completá título, descripción y categoría antes de crear",
                ),
            )}>
            <div className="space-y-2 lg:col-span-2">
              {reporte.trim() ? (
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
                      Hay un resumen de Nova, pero no se detectaron campos etiquetados.
                    </p>
                  )}
                </div>
              ) : conversationId ? (
                <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                  No hay un reporte técnico de Nova en este chat. Completá título, descripción y
                  categoría a mano.
                </p>
              ) : (
                <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                  Busca el cliente por nombre o cédula y completa título, descripción y categoría.
                </p>
              )}
              {catalogError ? (
                <p className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
                  {catalogError}. El botón de crear queda deshabilitado hasta refrescar el catálogo.
                </p>
              ) : null}
            </div>

            <section className="space-y-3">
              <CollapsibleBlock
                title="Cliente y contrato"
                open={openSections.cliente}
                onToggle={() => toggleSection("cliente")}>
                <Label htmlFor="ticket-client-search">Buscar cliente</Label>
                <Input
                  id="ticket-client-search"
                  value={clientQuery}
                  onChange={(event) => {
                    setClientQuery(event.target.value);
                    setSelectedClient(null);
                  }}
                  placeholder="Nombre o cédula"
                  autoComplete="off"
                  
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
                          <span className={`mt-0.5 block text-[11px] ${CRM_SURFACES.textMuted}`}>
                            {[
                              client.national_identification_number
                                ? `CI ${client.national_identification_number}`
                                : null,
                              client.phone_mobile,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Sin documento"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {selectedClient ? (
                  <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                    {selectedClient.name}
                    {selectedClient.national_identification_number
                      ? ` · CI ${selectedClient.national_identification_number}`
                      : ""}
                    {selectedClient.phone_mobile
                      ? ` · ${selectedClient.phone_mobile}`
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
                      <SelectTrigger >
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
                    className={`${missingMotivo ? "border-red-400" : ""}`}
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
                    className={`min-h-28 `}
                    {...form.register("description")}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label>Categoría</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadCatalog(true)}
                      disabled={isLoadingCatalog}>
                      Refrescar
                    </Button>
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
                    <SelectTrigger >
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
            </section>

            <section className="space-y-3">
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
                      <SelectTrigger >
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
                      className={`min-h-20 `}
                      placeholder="Descripción de la orden"
                      {...form.register("orderDescription")}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="start-at">Inicio</Label>
                        <Input
                          id="start-at"
                          type="datetime-local"
                          
                          {...form.register("startAt")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="end-at">Fin</Label>
                        <Input
                          id="end-at"
                          type="datetime-local"
                          
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
                  
                />
                <FacadeImageField
                  chatImages={chatImages}
                  value={{
                    mediaUrl: facadeMediaUrl || "",
                    messageId: facadeMessageId ?? null,
                  }}
                  disabled={isSubmitting}
                  onChange={(next) => {
                    form.setValue("facadeMediaUrl", next.mediaUrl, {
                      shouldDirty: true,
                    });
                    form.setValue("facadeMessageId", next.messageId, {
                      shouldDirty: true,
                    });
                  }}
                />
              </CollapsibleBlock>

              <CollapsibleBlock
                title="Técnico"
                open={openSections.tecnico}
                onToggle={() => toggleSection("tecnico")}>
                <EmployeePicker
                  employees={employees}
                  value={employeeId || ""}
                  onChange={(nextId) =>
                    form.setValue("employeeId", nextId, { shouldDirty: true })
                  }
                  disabled={isLoadingCatalog}
                />
                <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                  Se asigna en el CRM. El técnico ve estos tickets cuando escribe a Nova.
                </p>
              </CollapsibleBlock>

              <Button
                type="submit"
                disabled={Boolean(catalogError) || isLoadingCatalog || isSubmitting}
                className="w-full">
                <TicketPlus className="size-4" />
                Crear ticket y orden
              </Button>
            </section>
          </form>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar creación</AlertDialogTitle>
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
