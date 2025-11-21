"use client";
import { Button } from "@/components/ui/button";
import { ClientPay } from "@/db/Innover API/types/payments";
import { Download } from "lucide-react";
import React from "react";

export const PayHeader = ({ clients }: { clients: ClientPay[] }) => {
  const filteredClients = clients;
  const handleExportClients = () => {
    console.log("export");
  };
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Gestión de Pagos</h2>
        <p className="text-muted-foreground">
          Administra la información de todos tus Pagos ({filteredClients.length}{" "}
          de {clients.length})
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" onClick={handleExportClients}>
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>
    </div>
  );
};
