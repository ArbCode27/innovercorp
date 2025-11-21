"use client";
import React from "react";
import { motion } from "framer-motion";
import { Clock, Shield, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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

export const FeatureSection = () => {
  return (
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
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
