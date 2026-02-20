"use client";
import { Payment } from "@/types/payments";
import React from "react";
import FileInputModal from "../FileInputModal";

export const PayHeader = ({ clients }: { clients: Payment[] }) => {
  const filteredClients = clients;
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
        <FileInputModal />
      </div>
    </div>
  );
};
