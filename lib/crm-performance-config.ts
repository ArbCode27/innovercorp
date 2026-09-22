/**
 * Configuración de métricas y ponderaciones para el cálculo del ranking
 * de rendimiento de Asesores de Oficina y Técnicos de Campo.
 */

export interface PerformanceRankingConfig {
  agents: {
    /**
     * Umbral de volumen mínimo (m) para confianza plena en el puntaje bayesiano.
     * Cuanto mayor sea 'm', más casos se requieren para que el puntaje converja a la calidad cruda R.
     */
    minVolumeConfidence: number;
    /**
     * Casos mínimos resueltos en el período para ser elegible en el Podio de Premiación (#1).
     * Quien tenga menos figurará en la tabla con etiqueta "Volumen insuficiente".
     */
    minCasesForPodium: number;
    /**
     * Ponderación de calidad relativa (R). La suma debe ser 1.0.
     */
    weights: {
      fcr: number; // Peso de Tasa de No-Reapertura (Satisfacción)
      speed: number; // Peso de Velocidad / Duración promedio
    };
    /**
     * Media global a priori si no hay suficientes datos en el grupo (C fallback).
     */
    defaultPriorQuality: number;
  };
  technicians: {
    /**
     * Umbral de volumen mínimo (m) para confianza plena en el puntaje bayesiano.
     */
    minVolumeConfidence: number;
    /**
     * Tickets mínimos resueltos en el período para ser elegible en el Podio de Premiación (#1).
     */
    minTicketsForPodium: number;
    /**
     * Ponderación de calidad relativa (R). La suma debe ser 1.0.
     */
    weights: {
      resolution: number; // Peso de Tasa de Resolución (Efectividad)
      punctuality: number; // Peso de Puntualidad
    };
    /**
     * Media global a priori si no hay suficientes datos en el grupo (C fallback).
     */
    defaultPriorQuality: number;
  };
}

export const PERFORMANCE_CONFIG: PerformanceRankingConfig = {
  agents: {
    minVolumeConfidence: 15,
    minCasesForPodium: 10,
    weights: {
      fcr: 0.65,
      speed: 0.35,
    },
    defaultPriorQuality: 70,
  },
  technicians: {
    minVolumeConfidence: 5,
    minTicketsForPodium: 5,
    weights: {
      resolution: 0.60,
      punctuality: 0.40,
    },
    defaultPriorQuality: 70,
  },
};
