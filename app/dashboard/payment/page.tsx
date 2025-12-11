import { DashboardLayout } from "@/components/organisms/dashboard-layout";
import { PayHeader } from "@/components/molecules/payments/dashboard/PayHeader";
import { StadisticCards } from "@/components/molecules/payments/dashboard/StadisticCards";
import { ClientsPayTable } from "@/components/molecules/payments/dashboard/ClientsPayTable";
import { getAllPayments } from "@/actions/API/payments";

export default async function paymentPage() {
  const payments = await getAllPayments();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PayHeader clients={payments ? payments : []} />
        {/* Statistics Cards */}

        {/* Client Table */}
        <ClientsPayTable payments={payments ? payments : []} />
      </div>
    </DashboardLayout>
  );
}
