"use client";

import { NavLink } from "@/components/atoms/nav-link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  Home,
  Users,
  Calendar,
  Settings,
  BarChart3,
  Wifi,
  LogOut,
  Menu,
  X,
  Webhook,
  HandCoins,
} from "lucide-react";
import { useState } from "react";

export function DashboardSidebar() {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Clientes", href: "/dashboard/clients", icon: Users },
    { name: "Pagos", href: "/dashboard/payment", icon: HandCoins },
    { name: "Calendario", href: "/dashboard/calendar", icon: Calendar },
    { name: "Reportes", href: "/dashboard/reports", icon: BarChart3 },
    { name: "Integraciones", href: "/dashboard/integrations", icon: Webhook },
    { name: "Configuración", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:inset-0
      `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center space-x-2 p-6 border-b border-border">
            <Wifi className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Innover</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => (
              <NavLink key={item.name} href={item.href} icon={item.icon}>
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
