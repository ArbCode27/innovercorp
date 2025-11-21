"use client"

import { DashboardLayout } from "@/components/organisms/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Reportes y Análisis</h2>
          <p className="text-muted-foreground">Visualiza métricas y estadísticas de tu negocio</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span>Dashboard de Métricas</span>
            </CardTitle>
            <CardDescription>Próximamente: Gráficos y reportes detallados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Los reportes y análisis se implementarán próximamente</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
