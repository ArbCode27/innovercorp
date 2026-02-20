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
import { Users } from "lucide-react";
import { Payment, PaymentPromise } from "@/types/payments";

export const ClientsPromisePayTable = ({
  payments,
}: {
  payments: PaymentPromise[];
}) => {
  const [selectedClient, setSelectedClient] = useState<Payment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [status, setStatus] = useState("EN_PROCESO");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bank, setBank] = useState("Venezuela");
  const [equipmentFilter, setEquipmentFilter] = useState("all");

  // Filtered clients
  const filteredClients = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.status === status &&
        payment.created_at.split("T")[0] ===
          selectedDate.toISOString().split("T")[0] &&
        payment.bank.toLowerCase() === bank.toLowerCase() &&
        payment.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [
    payments,
    searchTerm,
    zoneFilter,
    status,
    equipmentFilter,
    bank,
    selectedDate,
  ]);

  const handleViewClient = (client: Payment) => {
    setSelectedClient(client);
    setIsDetailModalOpen(true);
  };

  const handleEditClient = (client: Payment) => {
    // TODO: Implement edit functionality
    console.log("Edit client:", client);
  };

  const handleDeleteClient = (client: Payment) => {
    // TODO: Implement delete functionality
    console.log("Delete client:", client);
  };

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
        payments={payments.length > 0 ? payments : []}
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
