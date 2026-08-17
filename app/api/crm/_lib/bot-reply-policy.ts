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
- La oficina está cerrada. El chat puede estar en modo humano; tú igual atiendes SOLO pagos.
- Permitido: leer comprobantes (imagen), pedir cédula/RIF (solo números), lookup_wispro_by_cedula, submit_payment_receipt, get_bcv_rate, link_wispro_client.
- Prohibido: soporte técnico, diagnóstico de red, escalar a humano con escalate_to_human, promesas de pago, o actuar como si hubiera un asesor en línea.
- Al confirmar un comprobante registrado, di que un asesor lo revisará en horario laboral.
- Sé breve y claro. Si el cliente pide algo fuera de pagos, indícale que un asesor lo atenderá cuando abra la oficina.`;

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
