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
import { Payment } from "@/types/payments";

export const ClientsPayTable = ({ payments }: { payments: Payment[] }) => {
  const [selectedClient, setSelectedClient] = useState<Payment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");

  // Filtered clients
  const filteredClients = useMemo(() => {
    return payments.filter((payment) => {
      const matchesSearch = payment.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [payments, searchTerm, zoneFilter, contractFilter, equipmentFilter]);

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
    setContractFilter("all");
    setEquipmentFilter("all");
  };

  const handleExportClients = () => {
    // TODO: Implement export functionality
    console.log("Export clients");
  };

  // Statistics
  const stats = {
    total: payments.length,
    active: payments.filter((c) => c.status === "APROBADO").length,
    pending: payments.filter((c) => c.status === "EN_PROCESO").length,
    expired: payments.filter((c) => c.status === "RECHAZADO").length,
  };
  return (
    <>
      <StadisticCards payments={filteredClients} />

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
          <PaymentTable
            payments={filteredClients}
            onViewClient={handleViewClient}
            onEditClient={handleEditClient}
            onDeleteClient={handleDeleteClient}
          />
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
