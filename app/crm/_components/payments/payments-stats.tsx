import { Ban, CheckCircle2, Clock, Wallet } from "lucide-react";
import { MetricCard } from "../shared/metric-card";
import type { CrmPaymentStatusCounts } from "../../_lib/payments";

interface PaymentsStatsProps {
  total: number;
  counts: CrmPaymentStatusCounts;
}

export const PaymentsStats = ({ total, counts }: PaymentsStatsProps) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    <MetricCard title="Total" value={total} description="registrados" icon={Wallet} />
    <MetricCard
      title="En proceso"
      value={counts.EN_PROCESO}
      description="pendientes de revisión"
      icon={Clock}
      tone="amber"
    />
    <MetricCard
      title="Aprobados"
      value={counts.APROBADO}
      description="verificados"
      icon={CheckCircle2}
      tone="green"
    />
    <MetricCard
      title="Rechazados"
      value={counts.RECHAZADO}
      description="no acreditados"
      icon={Ban}
      tone="red"
    />
  </div>
);
