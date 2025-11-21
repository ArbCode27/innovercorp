"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/organisms/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientFilters } from "@/components/molecules/clients/client-filters";
import { ClientTable } from "@/components/molecules/clients/client-table";
import { ClientDetailModal } from "@/components/molecules/clients/client-detail-modal";
import { Users, Plus, Download } from "lucide-react";
import { mockClients, type Client } from "@/lib/mock-data";
import { motion } from "framer-motion";

export default function ClientsPage() {
  const [clients] = useState<Client[]>(mockClients);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");

  // Filtered clients
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.cedula.includes(searchTerm);

      const matchesZone = zoneFilter === "all" || client.zone === zoneFilter;
      const matchesContract =
        contractFilter === "all" || client.contractStatus === contractFilter;
      const matchesEquipment =
        equipmentFilter === "all" ||
        client.equipmentInstalled === equipmentFilter;

      return (
        matchesSearch && matchesZone && matchesContract && matchesEquipment
      );
    });
  }, [clients, searchTerm, zoneFilter, contractFilter, equipmentFilter]);

  const handleViewClient = (client: Client) => {
    setSelectedClient(client);
    setIsDetailModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    // TODO: Implement edit functionality
    console.log("Edit client:", client);
  };

  const handleDeleteClient = (client: Client) => {
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
    total: clients.length,
    active: clients.filter((c) => c.contractStatus === "Activo").length,
    pending: clients.filter((c) => c.contractStatus === "Pendiente").length,
    expired: clients.filter((c) => c.contractStatus === "Vencido").length,
    equipmentPending: clients.filter(
      (c) => c.equipmentInstalled === "Pendiente por instalación"
    ).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Gestión de Clientes
            </h2>
            <p className="text-muted-foreground">
              Administra la información de todos tus clientes (
              {filteredClients.length} de {clients.length})
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExportClients}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground">
                  {stats.total}
                </div>
                <p className="text-xs text-muted-foreground">Total Clientes</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {stats.active}
                </div>
                <p className="text-xs text-muted-foreground">Activos</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {stats.expired}
                </div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.equipmentPending}
                </div>
                <p className="text-xs text-muted-foreground">Sin Equipo</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <ClientFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              zoneFilter={zoneFilter}
              onZoneFilterChange={setZoneFilter}
              contractFilter={contractFilter}
              onContractFilterChange={setContractFilter}
              equipmentFilter={equipmentFilter}
              onEquipmentFilterChange={setEquipmentFilter}
              onClearFilters={handleClearFilters}
            />
          </CardContent>
        </Card>

        {/* Client Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Lista de Clientes</span>
            </CardTitle>
            <CardDescription>
              Gestiona la información completa de todos tus clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientTable
              clients={filteredClients}
              onViewClient={handleViewClient}
              onEditClient={handleEditClient}
              onDeleteClient={handleDeleteClient}
            />
          </CardContent>
        </Card>

        {/* Client Detail Modal */}
        <ClientDetailModal
          client={selectedClient}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedClient(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
