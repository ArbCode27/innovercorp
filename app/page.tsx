"use client";

import type React from "react";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wifi,
  Shield,
  Clock,
  Star,
  CheckCircle,
  LogIn,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { RegisterPayForm } from "@/components/molecules/payments/RegisterPayForm";
import { RegisterPrePayForm } from "@/components/molecules/payments/RegisterPrePayForm";

interface FormData {
  fullName: string;
  cedula: string;
  address: string;
  phone: string;
  plan: string;
}

export default function LandingPage() {
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    cedula: "",
    address: "",
    phone: "",
    plan: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(""); // Clear error when user starts typing
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/webhook/n8n", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          source: "landing_page",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Error al procesar el registro");
      }

      console.log("[v0] Registration successful:", result);
      setSubmitted(true);
    } catch (error) {
      console.error("[v0] Registration error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Error al enviar el formulario. Intenta de nuevo."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const plans = [
    { value: "basico", label: "Plan Básico - 50 Mbps" },
    { value: "premium", label: "Plan Premium - 100 Mbps" },
    { value: "empresarial", label: "Plan Empresarial - 200 Mbps" },
    { value: "ultra", label: "Plan Ultra - 500 Mbps" },
  ];

  const features = [
    {
      icon: Wifi,
      title: "Internet de Alta Velocidad",
      description: "Conexión estable y rápida las 24 horas",
    },
    {
      icon: Shield,
      title: "Seguridad Garantizada",
      description: "Protección avanzada contra amenazas",
    },
    {
      icon: Clock,
      title: "Soporte 24/7",
      description: "Atención técnica especializada siempre disponible",
    },
  ];

  const testimonials = [
    {
      name: "María González",
      rating: 5,
      comment: "Excelente servicio, muy confiable y rápido.",
    },
    {
      name: "Carlos Rodríguez",
      rating: 5,
      comment: "El mejor internet que he tenido, recomendado 100%.",
    },
    {
      name: "Ana Martínez",
      rating: 5,
      comment: "Soporte técnico excepcional, resuelven todo rápidamente.",
    },
  ];

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <CheckCircle className="w-16 h-16 text-accent mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            ¡Registro Exitoso!
          </h1>
          <p className="text-muted-foreground mb-6">
            Tu solicitud ha sido procesada correctamente. Hemos creado tu perfil
            de cliente y contrato en nuestro sistema.
          </p>
          <div className="bg-muted/50 p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">
              📱 Te enviaremos una confirmación por WhatsApp
              <br />
              📧 También recibirás un email de confirmación
              <br />
              📞 Nos pondremos en contacto contigo en 24 horas
            </p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline">
            Registrar Otro Cliente
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wifi className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold text-foreground">
              TeleConnect
            </span>
          </div>
          <nav className="hidden md:flex space-x-6 items-center">
            <a
              href="#planes"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Planes
            </a>
            <a
              href="/payment"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Registrar pago
            </a>
            <a
              href="#soporte"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Soporte
            </a>
            <a
              href="#soporte"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Soporte
            </a>
            <a
              href="#contacto"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contacto
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/login")}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Acceso Admin
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/5">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 text-balance">
                Internet Confiable para tu Hogar y Empresa
              </h1>
              <p className="text-xl text-muted-foreground mb-8 text-pretty">
                Conectividad de alta velocidad con soporte técnico 24/7. Planes
                flexibles adaptados a tus necesidades.
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <feature.icon className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {feature.title}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Registration Form */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">
                    Regístrate Ahora
                  </CardTitle>
                  <CardDescription className="text-center">
                    Completa tus datos y nos pondremos en contacto contigo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nombre Completo</Label>
                      <Input
                        id="fullName"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) =>
                          handleInputChange("fullName", e.target.value)
                        }
                        placeholder="Ingresa tu nombre completo"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cedula">Cédula</Label>
                      <Input
                        id="cedula"
                        type="text"
                        required
                        value={formData.cedula}
                        onChange={(e) =>
                          handleInputChange("cedula", e.target.value)
                        }
                        placeholder="Número de cédula"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Input
                        id="address"
                        type="text"
                        required
                        value={formData.address}
                        onChange={(e) =>
                          handleInputChange("address", e.target.value)
                        }
                        placeholder="Dirección completa"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        placeholder="Número de teléfono"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="plan">Plan Contratado</Label>
                      <Select
                        value={formData.plan}
                        onValueChange={(value) =>
                          handleInputChange("plan", value)
                        }
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.value} value={plan.value}>
                              {plan.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Procesando..." : "Registrarme"}
                    </Button>

                    <div className="text-center text-xs text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg">
                      🔄 Tu registro será procesado automáticamente
                      <br />
                      📱 Recibirás confirmación por WhatsApp y email
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            ¿Por qué elegirnos?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="text-center h-full">
                  <CardContent className="pt-6">
                    <feature.icon className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Lo que dicen nuestros clientes
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-5 h-5 text-accent fill-current"
                        />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4">
                      "{testimonial.comment}"
                    </p>
                    <p className="font-semibold text-foreground">
                      - {testimonial.name}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Wifi className="w-6 h-6 text-primary" />
                <span className="text-lg font-bold text-foreground">
                  TeleConnect
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                Tu proveedor de internet confiable con más de 10 años de
                experiencia.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Servicios</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Internet Residencial</li>
                <li>Internet Empresarial</li>
                <li>Soporte Técnico</li>
                <li>Instalación</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Soporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Centro de Ayuda</li>
                <li>Contacto</li>
                <li>Estado del Servicio</li>
                <li>Reportar Problema</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Contacto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>📞 +1 (555) 123-4567</li>
                <li>✉️ soporte@teleconnect.com</li>
                <li>📍 Calle Principal 123</li>
                <li>🕒 24/7 Disponible</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 TeleConnect. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
