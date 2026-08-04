const LOG_PREFIX = "[DOLARVZLA]";
const DEFAULT_URL = "https://api.dolarvzla.com/public/usdt/exchange-rate";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type DolarVzlaQuote = {
  buy: number;
  sell: number;
  average: number;
  date: string;
};

export type BcvRateSnapshot = {
  /** Primary rate used for debt conversion (current.average). */
  rate: number;
  buy: number;
  sell: number;
  average: number;
  asOf: string;
  source: "dolarvzla";
  cached: boolean;
};

export class DolarVzlaError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "DolarVzlaError";
    this.status = status;
  }
}

type CacheEntry = {
  expiresAt: number;
  snapshot: BcvRateSnapshot;
};

let cache: CacheEntry | null = null;

const getApiUrl = () =>
  process.env.DOLARVZLA_API_URL?.trim() || DEFAULT_URL;

const getApiKey = () => process.env.DOLARVZLA_API_KEY?.trim() || "";

const parsePositiveNumber = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

const parseQuote = (raw: unknown): DolarVzlaQuote | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const buy = parsePositiveNumber(record.buy);
  const sell = parsePositiveNumber(record.sell);
  const average = parsePositiveNumber(record.average);
  const date =
    typeof record.date === "string" && record.date.trim()
      ? record.date.trim()
      : null;

  if (!buy || !sell || !average || !date) return null;
  return { buy, sell, average, date };
};

export const roundMoney = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Formats Bs with VE style: thousands ".", decimals ",". */
export const formatBolivares = (value: number) => {
  const fixed = roundMoney(value, 2).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Bs. ${withThousands},${decPart}`;
};

export const formatUsd = (value: number) => {
  const fixed = roundMoney(value, 2).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${withThousands},${decPart}`;
};

export const convertUsdToBs = (usd: number, rate: number) =>
  roundMoney(usd * rate, 2);

const fetchFreshRate = async (): Promise<BcvRateSnapshot> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new DolarVzlaError(
      "Falta DOLARVZLA_API_KEY en el servidor",
      503,
    );
  }

  const url = getApiUrl();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-dolarvzla-key": apiKey,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} request_failed`, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw new DolarVzlaError("No se pudo conectar con dolarvzla", 502);
  }

  const rawBody = await response.text();
  let parsed: unknown = null;
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    console.error(`${LOG_PREFIX} rejected`, {
      status: response.status,
      body: rawBody.slice(0, 300),
    });
    throw new DolarVzlaError(
      "dolarvzla rechazó la consulta de tasa",
      response.status,
    );
  }

  const root =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  const current = parseQuote(root?.current);
  if (!current) {
    console.error(`${LOG_PREFIX} invalid_payload`, {
      body: rawBody.slice(0, 300),
    });
    throw new DolarVzlaError("Respuesta de tasa inválida", 502);
  }

  const snapshot: BcvRateSnapshot = {
    rate: current.average,
    buy: current.buy,
    sell: current.sell,
    average: current.average,
    asOf: current.date,
    source: "dolarvzla",
    cached: false,
  };

  cache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    snapshot: { ...snapshot, cached: true },
  };

  console.log(`${LOG_PREFIX} rate_ok`, {
    rate: snapshot.rate,
    asOf: snapshot.asOf,
  });

  return snapshot;
};

/**
 * Returns current exchange rate (average). Uses a short in-memory cache.
 */
export const getBcvRate = async (): Promise<BcvRateSnapshot> => {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.snapshot;
  }

  return fetchFreshRate();
};

export const enrichDebtWithBcv = async (debtUsd: number) => {
  try {
    const rate = await getBcvRate();
    const debtBs = convertUsdToBs(debtUsd, rate.rate);
    return {
      ok: true as const,
      debt_usd: roundMoney(debtUsd, 2),
      debt_bs: debtBs,
      debt_usd_formatted: formatUsd(debtUsd),
      debt_bs_formatted: formatBolivares(debtBs),
      bcv_rate: rate.rate,
      bcv_buy: rate.buy,
      bcv_sell: rate.sell,
      bcv_as_of: rate.asOf,
      bcv_source: rate.source,
      bcv_cached: rate.cached,
    };
  } catch (error) {
    const message =
      error instanceof DolarVzlaError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo obtener la tasa BCV";

    console.warn(`${LOG_PREFIX} enrich_failed`, { message });
    return {
      ok: false as const,
      debt_usd: roundMoney(debtUsd, 2),
      debt_usd_formatted: formatUsd(debtUsd),
      debt_bs: null,
      debt_bs_formatted: null,
      bcv_rate: null,
      bcv_error: message,
      hint: "Informa solo el saldo en USD. No inventes tasa ni bolívares.",
    };
  }
};
