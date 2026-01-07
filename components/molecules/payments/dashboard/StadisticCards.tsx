import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Payment } from "@/types/payments";
import { ClientFilters } from "../payment-filters";

export const StadisticCards = ({
  payments,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  handleClearFilters,
  payType,
  setPayType,
  setBank,
  bank,
  selectedDate,
  setSelectedDate,
}: {
  payments: Payment[];
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  setBank: React.Dispatch<React.SetStateAction<string>>;
  bank: string;
  handleClearFilters: () => void;
  payType: string;
  setPayType: React.Dispatch<React.SetStateAction<string>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  selectedDate: Date | undefined;
}) => {
  const approved = payments.filter((item) => item.status === "APROBADO");
  const pending = payments.filter((item) => item.status === "EN_PROCESO");
  const rejected = payments.filter((item) => item.status === "RECHAZADO");
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">
                {payments.length}
              </div>
              <p className="text-xs text-muted-foreground">Total pagos</p>
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
                {approved.length}
              </div>
              <p className="text-xs text-muted-foreground">Confirmados</p>
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
                {pending.length}
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
                {rejected.length}
              </div>
              <p className="text-xs text-muted-foreground">Negados</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="">
          <ClientFilters
            payType={payType}
            setPayType={setPayType}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onClearFilters={handleClearFilters}
            bank={bank}
            setBank={setBank}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </CardContent>
      </Card>
    </>
  );
};
