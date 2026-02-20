"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React, { useMemo, useState } from "react";
import { PaymentTable } from "../payment-table";
import { StadisticCards } from "./StadisticCards";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Payment, PaymentPromise } from "@/types/payments";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export const ClientsPayTable = ({ payments }: { payments: Payment[] }) => {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams);
  const pathName = usePathname();
  const { replace } = useRouter();

  const nextPage = () => {
    if (params.get("page")) {
      const next = Number(params.get("page")) + 1;
      params.set("page", next.toString());
      replace(`${pathName}?${params}`);
    } else {
      params.set("page", "2");
      replace(`${pathName}?${params}`);
    }
  };

  const prevPage = () => {
    const prev = Number(params.get("page")) - 1;
    params.set("page", prev.toString());
    replace(`${pathName}?${params}`);
  };
  const [selectedClient, setSelectedClient] = useState<PaymentPromise | null>(
    null,
  );
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [status, setStatus] = useState("EN_PROCESO");
  const [payType, setPayType] = useState("false");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [bank, setBank] = useState("Venezuela");
  const [equipmentFilter, setEquipmentFilter] = useState("all");

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (payments.length > 0) {
      return payments.filter((payment) =>
        payment.status === status && selectedDate
          ? payment.createdAt.split("T")[0] ===
            selectedDate.toISOString().split("T")[0]
          : true &&
            payment.bank.toLowerCase() === bank.toLowerCase() &&
            payment.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    return [];
  }, [
    payments,
    searchTerm,
    zoneFilter,
    status,
    equipmentFilter,
    payType,
    bank,
    selectedDate,
  ]);

  // const handleViewClient = (client: PaymentPromise) => {
  //   setSelectedClient(client);
  //   setIsDetailModalOpen(true);
  // };

  // const handleEditClient = (client: PaymentPromise) => {
  //   // TODO: Implement edit functionality
  //   console.log("Edit client:", client);
  // };

  // const handleDeleteClient = (client: PaymentPromise) => {
  //   // TODO: Implement delete functionality
  //   console.log("Delete client:", client);
  // };

  const handleClearFilters = () => {
    setSearchTerm("");
    setZoneFilter("all");
    setStatus("EN_PROCESO");
    setEquipmentFilter("all");
  };

  const handleExportClients = () => {
    // TODO: Implement export functionality
    console.log("Export clients");
  };

  return (
    <>
      <StadisticCards
        searchTerm={searchTerm}
        handleClearFilters={handleClearFilters}
        setSearchTerm={setSearchTerm}
        statusFilter={status}
        setStatusFilter={setStatus}
        payments={payments}
        bank={bank}
        setBank={setBank}
        setSelectedDate={setSelectedDate}
        selectedDate={selectedDate}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Lista de Pagos</span>
          </CardTitle>
          <CardDescription>
            Gestiona la información completa de todos tus pagos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentTable payments={filteredClients} />
          <div className="flex justify-end gap-4 w-full p-4">
            <Button
              disabled={
                params.get("page") && params.get("page") !== "1" ? false : true
              }
              className="text-center"
              onClick={prevPage}
            >
              <ChevronLeft />
              Anterior
            </Button>
            <Button onClick={nextPage} className="text-center">
              Siguiente
              <ChevronRight />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Client Detail Modal */}
      {/* <ClientDetailModal
        client={selectedClient}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedClient(null);
        }}
      /> */}
    </>
  );
};
