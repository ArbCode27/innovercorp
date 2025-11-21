export interface Installation {
  id: string
  clientId: string
  clientName: string
  clientPhone: string
  address: string
  zone: string
  date: string
  time: string
  status: "Programada" | "En Progreso" | "Completada" | "Cancelada" | "Reprogramada"
  technician?: string
  equipmentType: string
  notes?: string
  priority: "Alta" | "Media" | "Baja"
}

export const mockInstallations: Installation[] = [
  {
    id: "1",
    clientId: "2",
    clientName: "Carlos Rodríguez Silva",
    clientPhone: "+1 (555) 234-5678",
    address: "Avenida Central 456, Zona Sur",
    zone: "Zona Sur",
    date: "2024-12-28",
    time: "09:00",
    status: "Programada",
    technician: "Juan Pérez",
    equipmentType: "Router + Módem",
    notes: "Cliente prefiere instalación en la mañana",
    priority: "Alta",
  },
  {
    id: "2",
    clientId: "3",
    clientName: "Ana Martínez López",
    clientPhone: "+1 (555) 345-6789",
    address: "Calle Secundaria 789, Zona Este",
    zone: "Zona Este",
    date: "2024-12-30",
    time: "14:00",
    status: "Programada",
    technician: "Miguel Torres",
    equipmentType: "Router Empresarial",
    priority: "Media",
  },
  {
    id: "3",
    clientId: "6",
    clientName: "Roberto Jiménez Herrera",
    clientPhone: "+1 (555) 678-9012",
    address: "Avenida Libertad 987, Zona Sur",
    zone: "Zona Sur",
    date: "2025-01-02",
    time: "10:30",
    status: "Programada",
    technician: "Carlos Mendoza",
    equipmentType: "Router + Extensor",
    notes: "Instalación en segundo piso",
    priority: "Baja",
  },
  {
    id: "4",
    clientId: "1",
    clientName: "María González Pérez",
    clientPhone: "+1 (555) 123-4567",
    address: "Calle Principal 123, Zona Norte",
    zone: "Zona Norte",
    date: "2025-01-03",
    time: "11:00",
    status: "Completada",
    technician: "Juan Pérez",
    equipmentType: "Router Premium",
    notes: "Instalación completada exitosamente",
    priority: "Media",
  },
  {
    id: "5",
    clientId: "4",
    clientName: "Luis Fernando Castro",
    clientPhone: "+1 (555) 456-7890",
    address: "Boulevard Principal 321, Zona Oeste",
    zone: "Zona Oeste",
    date: "2025-01-05",
    time: "15:00",
    status: "En Progreso",
    technician: "Miguel Torres",
    equipmentType: "Router + Switch",
    priority: "Alta",
  },
  {
    id: "6",
    clientId: "5",
    clientName: "Patricia Morales Vega",
    clientPhone: "+1 (555) 567-8901",
    address: "Calle Nueva 654, Zona Norte",
    zone: "Zona Norte",
    date: "2025-01-07",
    time: "08:30",
    status: "Reprogramada",
    technician: "Carlos Mendoza",
    equipmentType: "Router + Módem",
    notes: "Cliente solicitó cambio de horario",
    priority: "Media",
  },
]

export const installationStatuses = ["Programada", "En Progreso", "Completada", "Cancelada", "Reprogramada"] as const
export const priorities = ["Alta", "Media", "Baja"] as const
export const technicians = ["Juan Pérez", "Miguel Torres", "Carlos Mendoza", "Ana Rodríguez"]
