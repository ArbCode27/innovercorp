"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  cloneOfficeHoursConfig,
  DEFAULT_AFTER_HOURS_PAYMENTS,
  DEFAULT_OFFICE_HOURS,
  DEFAULT_OFFICE_TIMEZONE,
  OFFICE_WEEKDAY_OPTIONS,
  type AfterHoursPaymentsConfig,
  type OfficeHoursConfig,
  type WeekdayKey,
} from "../../_lib/office-hours";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { CrmButton } from "../shared/crm-button";

interface OfficeHoursSettingsSectionProps {
  isAdmin: boolean;
  officeHours?: OfficeHoursConfig | null;
  afterHoursPayments?: AfterHoursPaymentsConfig | null;
  onSave: (input: {
    office_hours: OfficeHoursConfig;
    after_hours_payments: AfterHoursPaymentsConfig;
  }) => Promise<void>;
}

const normalizeHm = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const toMinutes = (value: string) => {
  const normalized = normalizeHm(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
};

export const OfficeHoursSettingsSection = ({
  isAdmin,
  officeHours,
  afterHoursPayments,
  onSave,
}: OfficeHoursSettingsSectionProps) => {
  const savedOffice = useMemo(
    () => cloneOfficeHoursConfig(officeHours || DEFAULT_OFFICE_HOURS),
    [officeHours],
  );
  const savedAfterHours = useMemo(
    () => ({
      enabled:
        afterHoursPayments?.enabled ?? DEFAULT_AFTER_HOURS_PAYMENTS.enabled,
      allowedTools: [
        ...(afterHoursPayments?.allowedTools ||
          DEFAULT_AFTER_HOURS_PAYMENTS.allowedTools),
      ],
    }),
    [afterHoursPayments],
  );

  const [draftOffice, setDraftOffice] = useState(savedOffice);
  const [draftAfterHoursEnabled, setDraftAfterHoursEnabled] = useState(
    savedAfterHours.enabled,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setDraftOffice(savedOffice);
    setDraftAfterHoursEnabled(savedAfterHours.enabled);
    setValidationError(null);
  }, [savedOffice, savedAfterHours.enabled]);

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(draftOffice) !== JSON.stringify(savedOffice) ||
      draftAfterHoursEnabled !== savedAfterHours.enabled
    );
  }, [draftOffice, draftAfterHoursEnabled, savedOffice, savedAfterHours.enabled]);

  const handleToggleDay = (day: WeekdayKey, open: boolean) => {
    setDraftOffice((current) => {
      const next = cloneOfficeHoursConfig(current);
      if (!open) {
        next.days[day] = [];
        return next;
      }
      if (!next.days[day].length) {
        next.days[day] =
          day === "sat"
            ? [["08:00", "12:00"]]
            : day === "sun"
              ? [["08:00", "12:00"]]
              : [["08:00", "17:00"]];
      }
      return next;
    });
  };

  const handleTimeChange = (
    day: WeekdayKey,
    edge: "start" | "end",
    value: string,
  ) => {
    setDraftOffice((current) => {
      const next = cloneOfficeHoursConfig(current);
      const window = next.days[day][0] || ["08:00", "17:00"];
      const updated: [string, string] = [...window];
      updated[edge === "start" ? 0 : 1] = value;
      next.days[day] = [updated];
      return next;
    });
  };

  const handleSave = async () => {
    if (!isAdmin || !isDirty || isSaving) return;

    const normalized = cloneOfficeHoursConfig(draftOffice);
    normalized.timezone = normalized.timezone.trim() || DEFAULT_OFFICE_TIMEZONE;

    for (const { key, label } of OFFICE_WEEKDAY_OPTIONS) {
      const windows = normalized.days[key];
      if (!windows.length) continue;

      const start = normalizeHm(windows[0][0]);
      const end = normalizeHm(windows[0][1]);
      if (!start || !end) {
        setValidationError(`Horario inválido en ${label}. Usa formato HH:mm.`);
        return;
      }

      const startMin = toMinutes(start);
      const endMin = toMinutes(end);
      if (startMin === null || endMin === null || startMin >= endMin) {
        setValidationError(
          `En ${label}, la hora de apertura debe ser anterior al cierre.`,
        );
        return;
      }

      normalized.days[key] = [[start, end]];
    }

    setValidationError(null);
    setIsSaving(true);
    try {
      await onSave({
        office_hours: normalized,
        after_hours_payments: {
          enabled: draftAfterHoursEnabled,
          allowedTools: [...DEFAULT_AFTER_HOURS_PAYMENTS.allowedTools],
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!isAdmin || isSaving) return;
    setDraftOffice(cloneOfficeHoursConfig(DEFAULT_OFFICE_HOURS));
    setDraftAfterHoursEnabled(DEFAULT_AFTER_HOURS_PAYMENTS.enabled);
    setValidationError(null);
  };

  return (
    <section
      className={`rounded-xl border p-4 md:p-5 ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
      <div className="flex items-start gap-3">
        <Clock3
          className="mt-0.5 size-4 shrink-0 text-blue-500"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h3 className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
            Horario de oficina
          </h3>
          <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>
            Fuera de este horario (y los días cerrados, p. ej. domingo) Nova
            puede leer comprobantes y registrar pagos aunque el chat esté en
            modo humano.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${CRM_SURFACES.textPrimary}`}>
            Usar horario programado
          </p>
          <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
            Si se desactiva, Nova no interviene en chats humanos por horario.
          </p>
        </div>
        <Switch
          checked={draftOffice.enabled}
          disabled={!isAdmin || isSaving}
          onCheckedChange={(checked) =>
            setDraftOffice((current) => ({ ...current, enabled: checked }))
          }
          aria-label="Activar horario de oficina"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <label
            htmlFor="crm-office-timezone"
            className={`text-xs font-medium uppercase tracking-wide ${CRM_SURFACES.textLabel}`}>
            Zona horaria
          </label>
          <Input
            id="crm-office-timezone"
            value={draftOffice.timezone}
            onChange={(event) =>
              setDraftOffice((current) => ({
                ...current,
                timezone: event.target.value,
              }))
            }
            disabled={!isAdmin || isSaving || !draftOffice.enabled}
            placeholder={DEFAULT_OFFICE_TIMEZONE}
            className={`${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary}`}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2" aria-label="Horario por día">
        {OFFICE_WEEKDAY_OPTIONS.map(({ key, label }) => {
          const windows = draftOffice.days[key] || [];
          const isOpen = windows.length > 0;
          const start = windows[0]?.[0] || "08:00";
          const end = windows[0]?.[1] || "17:00";

          return (
            <li
              key={key}
              className={`rounded-lg border px-3 py-2.5 ${CRM_SURFACES.border} ${CRM_SURFACES.input}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[7rem] flex-1">
                  <p className={`text-sm font-medium ${CRM_SURFACES.textPrimary}`}>
                    {label}
                  </p>
                  <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                    {isOpen ? "Abierto" : "Cerrado (Nova pagos)"}
                  </p>
                </div>
                <Switch
                  checked={isOpen}
                  disabled={!isAdmin || isSaving || !draftOffice.enabled}
                  onCheckedChange={(checked) => handleToggleDay(key, checked)}
                  aria-label={`${label} abierto`}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={start}
                    disabled={
                      !isAdmin || isSaving || !draftOffice.enabled || !isOpen
                    }
                    onChange={(event) =>
                      handleTimeChange(key, "start", event.target.value)
                    }
                    aria-label={`${label} apertura`}
                    className={`w-[7.5rem] ${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary}`}
                  />
                  <span className={`text-xs ${CRM_SURFACES.textMuted}`}>a</span>
                  <Input
                    type="time"
                    value={end}
                    disabled={
                      !isAdmin || isSaving || !draftOffice.enabled || !isOpen
                    }
                    onChange={(event) =>
                      handleTimeChange(key, "end", event.target.value)
                    }
                    aria-label={`${label} cierre`}
                    className={`w-[7.5rem] ${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary}`}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3 ${CRM_SURFACES.border}`}>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${CRM_SURFACES.textPrimary}`}>
            Pagos fuera de horario
          </p>
          <p className={`mt-0.5 text-xs ${CRM_SURFACES.textMuted}`}>
            Permite a Nova leer comprobantes y registrar pagos cuando la oficina
            está cerrada, incluso en modo humano.
          </p>
        </div>
        <Switch
          checked={draftAfterHoursEnabled}
          disabled={!isAdmin || isSaving || !draftOffice.enabled}
          onCheckedChange={setDraftAfterHoursEnabled}
          aria-label="Activar pagos fuera de horario"
        />
      </div>

      {validationError ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">
          {validationError}
        </p>
      ) : null}

      {!isAdmin ? (
        <p className={`mt-4 text-sm ${CRM_SURFACES.textMuted}`}>
          Solo un administrador puede editar los horarios.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <CrmButton
            type="button"
            variant="primary"
            disabled={!isDirty || isSaving}
            onClick={() => void handleSave()}>
            {isSaving ? "Guardando…" : "Guardar horarios"}
          </CrmButton>
          <CrmButton
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => void handleRestoreDefaults()}>
            Restaurar predeterminados
          </CrmButton>
        </div>
      )}
    </section>
  );
};
