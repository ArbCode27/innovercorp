export interface Client {
  id: string
  fullName: string
  cedula: string
  address: string
  phone: string
  plan: string
  contractStatus: "Activo" | "Pendiente" | "Vencido"
  zone: string
  equipmentInstalled: "Sí" | "Pendiente por instalación"
  registrationDate: string
  email?: string
  notes?: string
}

export const mockClients: Client[] = [
  {
    id: "1",
    fullName: "María González Pérez",
    cedula: "12345678",
    address: "Calle Principal 123, Zona Norte",
    phone: "+1 (555) 123-4567",
    plan: "Plan Premium - 100 Mbps",
    contractStatus: "Activo",
    zone: "Zona Norte",
    equipmentInstalled: "Sí",
    registrationDate: "2024-01-15",
    email: "maria.gonzalez@email.com",
    notes: "Cliente preferencial, pago puntual",
  },
  {
    id: "2",
    fullName: "Carlos Rodríguez Silva",
    cedula: "87654321",
    address: "Avenida Central 456, Zona Sur",
    phone: "+1 (555) 234-5678",
    plan: "Plan Básico - 50 Mbps",
    contractStatus: "Activo",
    zone: "Zona Sur",
    equipmentInstalled: "Pendiente por instalación",
    registrationDate: "2024-02-20",
    email: "carlos.rodriguez@email.com",
  },
  {
    id: "3",
    fullName: "Ana Martínez López",
    cedula: "11223344",
    address: "Calle Secundaria 789, Zona Este",
    phone: "+1 (555) 345-6789",
    plan: "Plan Ultra - 500 Mbps",
    contractStatus: "Pendiente",
    zone: "Zona Este",
    equipmentInstalled: "Pendiente por instalación",
    registrationDate: "2024-03-10",
    email: "ana.martinez@email.com",
  },
  {
    id: "4",
    fullName: "Luis Fernando Castro",
    cedula: "55667788",
    address: "Boulevard Principal 321, Zona Oeste",
    phone: "+1 (555) 456-7890",
    plan: "Plan Empresarial - 200 Mbps",
    contractStatus: "Activo",
    zone: "Zona Oeste",
    equipmentInstalled: "Sí",
    registrationDate: "2024-01-05",
    email: "luis.castro@email.com",
  },
  {
    id: "5",
    fullName: "Patricia Morales Vega",
    cedula: "99887766",
    address: "Calle Nueva 654, Zona Norte",
    phone: "+1 (555) 567-8901",
    plan: "Plan Premium - 100 Mbps",
    contractStatus: "Vencido",
    zone: "Zona Norte",
    equipmentInstalled: "Sí",
    registrationDate: "2023-12-01",
    email: "patricia.morales@email.com",
    notes: "Contrato vencido, contactar para renovación",
  },
  {
    id: "6",
    fullName: "Roberto Jiménez Herrera",
    cedula: "33445566",
    address: "Avenida Libertad 987, Zona Sur",
    phone: "+1 (555) 678-9012",
    plan: "Plan Básico - 50 Mbps",
    contractStatus: "Activo",
    zone: "Zona Sur",
    equipmentInstalled: "Sí",
    registrationDate: "2024-02-14",
    email: "roberto.jimenez@email.com",
  },
]

export const zones = ["Zona Norte", "Zona Sur", "Zona Este", "Zona Oeste"]
export const plans = [
  "Plan Básico - 50 Mbps",
  "Plan Premium - 100 Mbps",
  "Plan Empresarial - 200 Mbps",
  "Plan Ultra - 500 Mbps",
]
export const contractStatuses = ["Activo", "Pendiente", "Vencido"] as const
export const equipmentStatuses = ["Sí", "Pendiente por instalación"] as const
