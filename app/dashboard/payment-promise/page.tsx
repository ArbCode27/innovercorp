import { DashboardLayout } from "@/components/organisms/dashboard-layout";
import { PayHeader } from "@/components/molecules/payments/dashboard/PayHeader";
import { StadisticCards } from "@/components/molecules/payments/dashboard/StadisticCards";
import { ClientsPayTable } from "@/components/molecules/payments/dashboard/ClientsPayTable";
import { getAllPromisePayments } from "@/actions/API/payments";
import { ClientsPromisePayTable } from "@/components/molecules/payments/dashboard/ClientsPromisePayTable";

export default async function paymentPage() {
  const payments = await getAllPromisePayments();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PayHeader clients={payments ? payments : []} />
        {/* Statistics Cards */}

        {/* Client Table */}
        <ClientsPromisePayTable payments={payments ? payments : []} />
      </div>
    </DashboardLayout>
  );
}
