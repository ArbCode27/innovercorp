import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ClientFilters } from "../payment-filters";

export const StadisticCards = () => {
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
              <div className="text-2xl font-bold text-foreground"></div>
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
                {/* {stats.active} */}
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
                {/* {stats.pending} */}
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
                {/* {stats.expired} */}
              </div>
              <p className="text-xs text-muted-foreground">Negados</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      {/* <Card>
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
      </Card> */}
    </>
  );
};
