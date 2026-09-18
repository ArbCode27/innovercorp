import { extractMapsFromText } from "./maps-link";
import { parseReporte, reporteToPlainDescription } from "./parseReporte";

const stripMapsFromAddress = (value: string) =>
  value
    .replace(/\|\s*Maps:\s*-?\d[\d.,\s-]*$/i, "")
    .replace(/Maps:\s*-?\d[\d.,\s-]+/i, "")
    .replace(/\s+\|\s+$/, "")
    .trim();

export const casoFieldsFromReporte = (reporte: string) => {
  const parsed = parseReporte(reporte);
  const maps = extractMapsFromText(
    [parsed.google_maps, parsed.maps, parsed.ubicacion, parsed.ubicacion_detallada, parsed.direccion, reporte]
      .filter(Boolean)
      .join("\n"),
  );
  const address = stripMapsFromAddress(
    parsed.ubicacion || parsed.ubicacion_detallada || parsed.direccion || "",
  );
  const title = (parsed.motivo || parsed.accion_requerida || "").slice(0, 80);
  const cause =
    parsed.posible_causa || parsed.motivo || parsed.accion_requerida || null;
  const orderDescription =
    [parsed.accion_requerida, parsed.posible_causa, parsed.zona_opt]
      .filter(Boolean)
      .join(" · ") || null;

  return {
    parsed,
    title,
    description: reporte.trim() ? reporteToPlainDescription(reporte) : "",
    cause,
    orderDescription,
    mapsUrl: maps.mapsUrl,
    latitude: maps.latitude,
    longitude: maps.longitude,
    addressText: address || null,
  };
};
