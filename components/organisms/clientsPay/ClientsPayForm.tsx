"use client";
import React from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterPayForm } from "@/components/molecules/payments/RegisterPayForm";
import { RegisterPrePayForm } from "@/components/molecules/payments/RegisterPrePayForm";
import { Clock, Shield, Wifi } from "lucide-react";

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

export const ClientsPayForm = () => {
  return (
    <section
      id="Form_Pay"
      className="relative py-20 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/5"
    >
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
          <Tabs defaultValue="pay" className="w-full">
            <TabsList className="border border-[1px] p-0 min-w-full overflow-hidden">
              <TabsTrigger className="text-md rounded-none" value="pre-pay">
                Registrar pago
              </TabsTrigger>
              <TabsTrigger className="text-md rounded-none" value="pay">
                Registrar promesa
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pay">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-2xl text-center">
                      Regístrate tu pago
                    </CardTitle>
                    <CardDescription className="text-center">
                      Completa tus datos y para validar su depósito
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RegisterPayForm />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
            <TabsContent value="pre-pay">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-2xl text-center">
                      Regístrate tu promesa
                    </CardTitle>
                    <CardDescription className="text-center">
                      Completa tus datos para validar tu depósito
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RegisterPrePayForm />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
};
