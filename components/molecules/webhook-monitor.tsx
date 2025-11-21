"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Webhook, Activity, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react"

interface WebhookLog {
  id: string
  timestamp: string
  method: string
  endpoint: string
  status: "success" | "error" | "pending"
  data?: any
  response?: any
  duration?: number
}

export function WebhookMonitor() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Mock webhook logs for demonstration
  const mockLogs: WebhookLog[] = [
    {
      id: "1",
      timestamp: new Date().toISOString(),
      method: "POST",
      endpoint: "/api/webhook/n8n",
      status: "success",
      data: { fullName: "María González", plan: "premium" },
      response: { customerId: "cust_123", contractId: "cont_456" },
      duration: 2340,
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      method: "POST",
      endpoint: "/api/webhook/n8n",
      status: "success",
      data: { fullName: "Carlos Rodríguez", plan: "basico" },
      response: { customerId: "cust_124", contractId: "cont_457" },
      duration: 1890,
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 600000).toISOString(),
      method: "POST",
      endpoint: "/api/webhook/test",
      status: "error",
      data: { test: "data" },
      response: { error: "Validation failed" },
      duration: 150,
    },
  ]

  useEffect(() => {
    setLogs(mockLogs)
  }, [])

  const testWebhook = async () => {
    setIsLoading(true)

    try {
      const testData = {
        fullName: "Usuario de Prueba",
        cedula: "12345678",
        address: "Dirección de Prueba 123",
        phone: "+1 (555) 999-0000",
        plan: "premium",
        timestamp: new Date().toISOString(),
      }

      const response = await fetch("/api/webhook/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      })

      const result = await response.json()

      const newLog: WebhookLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        method: "POST",
        endpoint: "/api/webhook/test",
        status: response.ok ? "success" : "error",
        data: testData,
        response: result,
        duration: Math.floor(Math.random() * 2000) + 500,
      }

      setLogs((prev) => [newLog, ...prev])
    } catch (error) {
      console.error("Test webhook failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />
      default:
        return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Exitoso</Badge>
      case "error":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Error</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("es-ES", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Webhook className="w-5 h-5 text-primary" />
            <span>Monitor de Webhooks</span>
          </div>
          <Button variant="outline" size="sm" onClick={testWebhook} disabled={isLoading}>
            {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
            Probar Webhook
          </Button>
        </CardTitle>
        <CardDescription>Monitorea las llamadas a webhooks y la integración con n8n + Wispro</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay logs de webhooks disponibles</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="flex-shrink-0 mt-1">{getStatusIcon(log.status)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{log.method}</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{log.endpoint}</code>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(log.status)}
                      <span className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </div>

                  {log.data && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Datos:</span>
                      <pre className="text-xs bg-muted/50 p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.response && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Respuesta:</span>
                      <pre className="text-xs bg-muted/50 p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(log.response, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.duration && <div className="text-xs text-muted-foreground">Duración: {log.duration}ms</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
