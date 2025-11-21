"use client";
import { Button } from "@/components/ui/button";
import { LogIn, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

export const Header = () => {
  const router = useRouter();
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Wifi className="w-8 h-8 text-primary" />
          <span className="text-xl font-bold text-foreground">TeleConnect</span>
        </div>
        <nav className="hidden md:flex space-x-6 items-center">
          <a
            href="#planes"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Planes
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
  );
};
