/**
 * Utilidades de formateo para el dashboard de rendimiento y ranking del CRM.
 * Implementa Intl.NumberFormat y conversión de unidades de tiempo para máxima legibilidad.
 */

const numberFormatter = new Intl.NumberFormat("es-VE", {
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("es-VE", {
  maximumFractionDigits: 0,
});

/**
 * Formatea un número con separadores de miles y decimales según configuración regional.
 */
export const formatNumber = (
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "—";
  }

  if (options) {
    return new Intl.NumberFormat("es-VE", options).format(value);
  }

  return Number.isInteger(value)
    ? integerFormatter.format(value)
    : numberFormatter.format(value);
};

/**
 * Convierte minutos a un formato de duración de alta legibilidad humana (días y horas o horas y minutos).
 * Ejemplo: 45463 min -> "31d 13h" (o "757h 43m" si se especifica horas acumuladas).
 */
export const formatDurationMinutes = (
  minutes: number | null | undefined,
): {
  display: string;
  daysHours: string;
  hoursMinutes: string;
  rawFormatted: string;
} => {
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes <= 0) {
    return {
      display: "—",
      daysHours: "—",
      hoursMinutes: "—",
      rawFormatted: "0 min",
    };
  }

  const rawFormatted = `${integerFormatter.format(minutes)} min`;

  // Cálculo acumulativo en horas y minutos
  const totalHours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  const hoursMinutes =
    totalHours > 0
      ? remainingMins > 0
        ? `${integerFormatter.format(totalHours)}h ${remainingMins}m`
        : `${integerFormatter.format(totalHours)}h`
      : `${remainingMins}m`;

  // Cálculo en días, horas y minutos
  const days = Math.floor(minutes / (24 * 60));
  const remainingHours = Math.floor((minutes % (24 * 60)) / 60);

  let daysHours = "";
  if (days > 0) {
    daysHours = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  } else if (totalHours > 0) {
    daysHours = remainingMins > 0 ? `${totalHours}h ${remainingMins}m` : `${totalHours}h`;
  } else {
    daysHours = `${remainingMins}m`;
  }

  return {
    display: daysHours, // Formato preferido por defecto por el usuario (31d 13h)
    daysHours,
    hoursMinutes,
    rawFormatted,
  };
};

/**
 * Formatea duración en horas para técnicos.
 */
export const formatDurationHours = (
  hours: number | null | undefined,
): { display: string; daysHours: string } => {
  if (hours === null || hours === undefined || isNaN(hours) || hours <= 0) {
    return { display: "—", daysHours: "—" };
  }

  const rounded = Math.round(hours * 10) / 10;
  if (rounded >= 24) {
    const d = Math.floor(rounded / 24);
    const remH = Math.round(rounded % 24);
    return {
      display: `${numberFormatter.format(rounded)}h`,
      daysHours: remH > 0 ? `${d}d ${remH}h` : `${d}d`,
    };
  }

  return {
    display: `${numberFormatter.format(rounded)}h`,
    daysHours: `${numberFormatter.format(rounded)}h`,
  };
};
