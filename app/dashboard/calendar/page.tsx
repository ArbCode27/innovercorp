"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/organisms/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarGrid } from "@/components/molecules/calendar-grid"
import { InstallationList } from "@/components/molecules/installation-list"
import { InstallationDetailModal } from "@/components/molecules/installation-detail-modal"
import { Calendar, Plus, Filter } from "lucide-react"
import { mockInstallations, type Installation } from "@/lib/installation-data"
import { motion } from "framer-motion"

export default function CalendarPage() {
  const [installations] = useState<Installation[]>(mockInstallations)
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar")

  const handleViewInstallation = (installation: Installation) => {
    setSelectedInstallation(installation)
    setIsDetailModalOpen(true)
  }

  const handleEditInstallation = (installation: Installation) => {
    // TODO: Implement edit functionality
    console.log("Edit installation:", installation)
  }

  // Get upcoming installations (next 7 days)
  const upcomingInstallations = useMemo(() => {
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    return installations
      .filter((installation) => {
        const installDate = new Date(installation.date)
        return installDate >= today && installDate <= nextWeek && installation.status !== "Completada"
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [installations])

  // Statistics
  const stats = {
    total: installations.length,
    programadas: installations.filter((i) => i.status === "Programada").length,
    enProgreso: installations.filter((i) => i.status === "En Progreso").length,
    completadas: installations.filter((i) => i.status === "Completada").length,
    pendientes: installations.filter((i) => i.status === "Programada" || i.status === "Reprogramada").length,
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Calendario de Instalaciones</h2>
            <p className="text-muted-foreground">
              Programa y gestiona las instalaciones de equipos ({stats.pendientes} pendientes)
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setViewMode(viewMode === "calendar" ? "list" : "calendar")}>
              {viewMode === "calendar" ? "Vista Lista" : "Vista Calendario"}
            </Button>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Instalación
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total</p>
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
                <div className="text-2xl font-bold text-blue-600">{stats.programadas}</div>
                <p className="text-xs text-muted-foreground">Programadas</p>
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
                <div className="text-2xl font-bold text-yellow-600">{stats.enProgreso}</div>
                <p className="text-xs text-muted-foreground">En Progreso</p>
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
                <div className="text-2xl font-bold text-green-600">{stats.completadas}</div>
                <p className="text-xs text-muted-foreground">Completadas</p>
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
                <div className="text-2xl font-bold text-orange-600">{upcomingInstallations.length}</div>
                <p className="text-xs text-muted-foreground">Esta Semana</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {viewMode === "calendar" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span>Vista de Calendario</span>
                  </CardTitle>
                  <CardDescription>Haz clic en una instalación para ver los detalles</CardDescription>
                </CardHeader>
                <CardContent>
                  <CalendarGrid installations={installations} onInstallationClick={handleViewInstallation} />
                </CardContent>
              </Card>
            ) : (
              <InstallationList
                installations={installations}
                onViewInstallation={handleViewInstallation}
                title="Todas las Instalaciones"
              />
            )}
          </div>

          <div className="space-y-6">
            <InstallationList
              installations={upcomingInstallations}
              onViewInstallation={handleViewInstallation}
              title="Próximas Instalaciones"
            />

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Plus className="w-4 h-4 mr-2" />
                  Programar Instalación
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Calendar className="w-4 h-4 mr-2" />
                  Ver Disponibilidad
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrar por Técnico
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Installation Detail Modal */}
        <InstallationDetailModal
          installation={selectedInstallation}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false)
            setSelectedInstallation(null)
          }}
          onEdit={handleEditInstallation}
        />
      </div>
    </DashboardLayout>
  )
}
