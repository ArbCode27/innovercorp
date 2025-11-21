"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { motion } from "framer-motion";
import React from "react";

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

export const Testimonials = () => {
  return (
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
  );
};
