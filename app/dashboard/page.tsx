"use client";
import { DashboardLayout } from "@/components/organisms/dashboard-layout";
import { StatCard } from "@/components/atoms/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar,
  Settings,
  Wifi,
  TrendingUp,
  AlertCircle,
  Webhook,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const router = useRouter();

  const stats = [
    {
      title: "Total Clientes",
      value: "1,234",
      description: "desde el mes pasado",
      trend: "+12%",
      icon: Users,
    },
    {
      title: "Instalaciones Pendientes",
      value: "23",
      description: "para esta semana",
      icon: Calendar,
    },
    {
      title: "Contratos Activos",
      value: "1,180",
      description: "95.6% del total",
      icon: Settings,
    },
    {
      title: "Ingresos Mensuales",
      value: "$45,231",
      description: "desde el mes pasado",
      trend: "+8%",
      icon: Wifi,
    },
  ];

  const quickActions = [
    {
      title: "Gestión de Clientes",
      description:
        "Ver lista completa de clientes, estados de contrato y información de contacto",
      icon: Users,
      href: "/dashboard/clients",
      color: "text-blue-600",
    },
    {
      title: "Calendario de Instalaciones",
      description:
        "Programar y gestionar instalaciones de equipos por zona y fecha",
      icon: Calendar,
      href: "/dashboard/calendar",
      color: "text-green-600",
    },
    {
      title: "Integraciones y APIs",
      description: "Monitorear webhooks, n8n workflows y conexiones con Wispro",
      icon: Webhook,
      href: "/dashboard/integrations",
      color: "text-purple-600",
    },
    {
      title: "Reportes y Análisis",
      description:
        "Ver métricas de rendimiento, ingresos y estadísticas de clientes",
      icon: TrendingUp,
      href: "/dashboard/reports",
      color: "text-orange-600",
    },
  ];

  const recentActivity = [
    {
      type: "new_client",
      message: "Nuevo cliente registrado: María González",
      time: "Hace 2 horas",
    },
    {
      type: "webhook",
      message: "Webhook n8n procesado exitosamente",
      time: "Hace 3 horas",
    },
    {
      type: "installation",
      message: "Instalación completada en Zona Norte",
      time: "Hace 4 horas",
    },
    {
      type: "payment",
      message: "Pago recibido de Carlos Rodríguez",
      time: "Hace 6 horas",
    },
    {
      type: "support",
      message: "Ticket de soporte resuelto #1234",
      time: "Hace 8 horas",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Bienvenido al Dashboard
          </h2>
          <p className="text-muted-foreground">
            Aquí tienes un resumen de la actividad de tu plataforma de
            telecomunicaciones
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <StatCard {...stat} />
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-foreground">
              Acciones Rápidas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                >
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center space-x-2 text-sm">
                        <action.icon className={`w-5 h-5 ${action.color}`} />
                        <span>{action.title}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-xs mb-3">
                        {action.description}
                      </CardDescription>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => router.push(action.href)}
                      >
                        Acceder
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-foreground">
              Actividad Reciente
            </h3>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <span>Últimas Actividades</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                      className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30"
                    >
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          {activity.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.time}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
