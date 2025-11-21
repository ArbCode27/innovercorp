"use client"

import { DashboardLayout } from "@/components/organisms/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Configuración</h2>
          <p className="text-muted-foreground">Administra la configuración del sistema y usuarios</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-primary" />
              <span>Configuración del Sistema</span>
            </CardTitle>
            <CardDescription>Próximamente: Panel de configuración completo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Las opciones de configuración se implementarán próximamente</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
