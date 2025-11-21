"use client"

import { DashboardLayout } from "@/components/organisms/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { WebhookMonitor } from "@/components/molecules/webhook-monitor"
import { Webhook, Settings, Zap, MessageSquare, Mail, Send, ExternalLink } from "lucide-react"

export default function IntegrationsPage() {
  const integrations = [
    {
      name: "n8n Workflow",
      description: "Automatización de registro de clientes",
      status: "Conectado",
      type: "automation",
      icon: Zap,
      endpoint: "/api/webhook/n8n",
      lastActivity: "Hace 5 minutos",
    },
    {
      name: "Wispro API",
      description: "Gestión de clientes y contratos",
      status: "Conectado",
      type: "api",
      icon: Settings,
      endpoint: "https://api.wispro.com",
      lastActivity: "Hace 2 minutos",
    },
    {
      name: "WhatsApp Business",
      description: "Notificaciones por WhatsApp",
      status: "Configurado",
      type: "notification",
      icon: MessageSquare,
      endpoint: "WhatsApp Business API",
      lastActivity: "Hace 1 hora",
    },
    {
      name: "Gmail SMTP",
      description: "Envío de correos electrónicos",
      status: "Configurado",
      type: "notification",
      icon: Mail,
      endpoint: "smtp.gmail.com",
      lastActivity: "Hace 30 minutos",
    },
    {
      name: "Telegram Bot",
      description: "Notificaciones por Telegram",
      status: "Desconectado",
      type: "notification",
      icon: Send,
      endpoint: "Telegram Bot API",
      lastActivity: "Sin actividad",
    },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Conectado":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Conectado</Badge>
      case "Configurado":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Configurado</Badge>
      case "Desconectado":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Desconectado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "automation":
        return "🔄"
      case "api":
        return "🔗"
      case "notification":
        return "📱"
      default:
        return "⚙️"
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Integraciones y APIs</h2>
            <p className="text-muted-foreground">Gestiona las conexiones con n8n, Wispro y servicios de notificación</p>
          </div>
          <Button>
            <ExternalLink className="w-4 h-4 mr-2" />
            Configurar Nueva
          </Button>
        </div>

        {/* Integration Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    <integration.icon className="w-5 h-5 text-primary" />
                    <span>{integration.name}</span>
                  </div>
                  <span className="text-lg">{getTypeIcon(integration.type)}</span>
                </CardTitle>
                <CardDescription>{integration.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estado:</span>
                    {getStatusBadge(integration.status)}
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">Endpoint:</span>
                    <p className="text-sm font-mono bg-muted/50 p-2 rounded mt-1 break-all">{integration.endpoint}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Última actividad:</span>
                    <span className="text-sm">{integration.lastActivity}</span>
                  </div>

                  <Button variant="outline" size="sm" className="w-full bg-transparent">
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Webhook Monitor */}
        <WebhookMonitor />

        {/* Configuration Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Webhook className="w-5 h-5 text-primary" />
              <span>Configuración de n8n</span>
            </CardTitle>
            <CardDescription>Instrucciones para configurar el workflow de automatización</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2">URL del Webhook:</h4>
                <code className="text-sm bg-background p-2 rounded border block">
                  {typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com"}/api/webhook/n8n
                </code>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Pasos del Workflow n8n:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Webhook Trigger - Recibe datos del formulario de registro</li>
                  <li>Crear Cliente en Wispro - POST /customers</li>
                  <li>Crear Contrato en Wispro - POST /contracts</li>
                  <li>Enviar WhatsApp - Notificación de confirmación</li>
                  <li>Enviar Email - Respaldo por correo electrónico</li>
                </ol>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Este es un entorno de demostración. En producción, configura las credenciales
                  reales de Wispro API y los servicios de notificación.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
