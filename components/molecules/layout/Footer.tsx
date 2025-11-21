import { Wifi } from "lucide-react";
import React from "react";

export const Footer = () => {
  return (
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
  );
};
