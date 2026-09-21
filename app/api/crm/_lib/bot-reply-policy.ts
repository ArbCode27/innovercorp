import {
  DEFAULT_AFTER_HOURS_PAYMENTS,
  isOfficeClosed,
  type AfterHoursPaymentsConfig,
  type OfficeHoursConfig,
  resolveOfficeHoursFromEnv,
} from "./office-hours";

export type BotReplyMode = "full" | "after_hours_payments" | "forced" | "skip";

export type BotReplyPolicy = {
  mode: BotReplyMode;
  shouldRun: boolean;
  officeClosed: boolean;
  reason: string;
  allowedTools: string[] | null;
};

export const AFTER_HOURS_PAYMENTS_PROMPT = `Modo FUERA DE OFICINA / DOMINGO (obligatorio):
- La oficina está cerrada. El chat puede estar en modo humano; tú igual atiendes pagos y tickets.
- Permitido: leer comprobantes (imagen), pedir cédula/RIF (solo números), lookup_wispro_by_cedula, submit_payment_receipt, get_bcv_rate, link_wispro_client, get_client_ticket.
- Si el remitente es técnico (rol=tecnico_wispro): list_my_pending_tickets, get_my_ticket_detail y finalize_my_ticket están permitidos. El listado es solo texto; la ficha con foto va con get_my_ticket_detail. No ofrezcas de nuevo el listado si la cola ya está inyectada; cierra con intención informal.
- Si el remitente es supervisor (rol=supervisor_wispro): get_technician_assigned_tickets está permitido para consultar la cola de un técnico por nombre.
- Prohibido: diagnóstico de red, escalate_to_human, promesas de pago, o actuar como si hubiera un asesor en línea.
- Al confirmar un comprobante registrado, di que un asesor lo revisará al abrir. Usa proxima_apertura y el horario inyectado; no inventes horas.
- Si el cliente pide algo fuera de pagos/tickets, informa que la oficina está cerrada y da el horario inyectado. No digas “en breve”.`;

/**
 * Decide if Nova may reply when human_mode is on.
 * Does NOT clear human_mode — ownership stays with the advisor.
 */
export const resolveBotReplyPolicy = (input: {
  humanMode: boolean;
  forceRun?: boolean;
  now?: Date;
  officeHours?: OfficeHoursConfig;
  afterHoursPayments?: AfterHoursPaymentsConfig;
}): BotReplyPolicy => {
  const officeHours = input.officeHours ?? resolveOfficeHoursFromEnv();
  const afterHours =
    input.afterHoursPayments ?? DEFAULT_AFTER_HOURS_PAYMENTS;
  const now = input.now ?? new Date();
  const officeClosed = isOfficeClosed(now, officeHours);

  if (input.forceRun) {
    return {
      mode: "forced",
      shouldRun: true,
      officeClosed,
      reason: "force_run",
      allowedTools: null,
    };
  }

  if (!input.humanMode) {
    return {
      mode: "full",
      shouldRun: true,
      officeClosed,
      reason: "bot_mode",
      allowedTools: null,
    };
  }

  // human_mode: only after-hours payments bypass.
  if (afterHours.enabled && officeClosed) {
    return {
      mode: "after_hours_payments",
      shouldRun: true,
      officeClosed: true,
      reason: "office_closed_payments",
      allowedTools: [...afterHours.allowedTools],
    };
  }

  return {
    mode: "skip",
    shouldRun: false,
    officeClosed,
    reason: officeClosed
      ? "after_hours_payments_disabled"
      : "human_mode_within_office_hours",
    allowedTools: null,
  };
};
