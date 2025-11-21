import { type NextRequest, NextResponse } from "next/server"
import { WisproAPI, NotificationService } from "@/lib/api-services"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("[v0] Received webhook data:", body)

    // Validate required fields
    const { fullName, cedula, address, phone, plan } = body
    if (!fullName || !cedula || !address || !phone || !plan) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Step 1: Create customer in Wispro
    console.log("[v0] Step 1: Creating customer in Wispro...")
    const customer = await WisproAPI.createCustomer({
      fullName,
      cedula,
      address,
      phone,
      email: `${cedula}@teleconnect-temp.com`, // Generate temp email
    })

    // Step 2: Create contract in Wispro
    console.log("[v0] Step 2: Creating contract in Wispro...")
    const contract = await WisproAPI.createContract({
      customerId: customer.id,
      plan,
    })

    // Step 3: Send confirmation notifications
    console.log("[v0] Step 3: Sending confirmation notifications...")

    const confirmationMessage = `¡Hola ${fullName}! 

Tu registro en TeleConnect ha sido exitoso. 

📋 Detalles de tu solicitud:
• Plan: ${plan}
• Dirección: ${address}
• Teléfono: ${phone}

📞 Nos pondremos en contacto contigo en las próximas 24 horas para coordinar la instalación.

¡Gracias por elegir TeleConnect!`

    // Send WhatsApp notification (primary)
    const whatsappSent = await NotificationService.sendConfirmation({
      type: "whatsapp",
      recipient: phone,
      message: confirmationMessage,
      customerName: fullName,
    })

    // Send email notification (backup)
    const emailSent = await NotificationService.sendConfirmation({
      type: "email",
      recipient: customer.email,
      message: confirmationMessage,
      customerName: fullName,
    })

    // Log the complete workflow
    console.log("[v0] Workflow completed successfully:", {
      customer: customer.id,
      contract: contract.id,
      notifications: {
        whatsapp: whatsappSent,
        email: emailSent,
      },
    })

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Customer registration processed successfully",
      data: {
        customerId: customer.id,
        contractId: contract.id,
        notifications: {
          whatsapp: whatsappSent,
          email: emailSent,
        },
      },
    })
  } catch (error) {
    console.error("[v0] Webhook processing error:", error)

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Handle GET requests for webhook testing
export async function GET() {
  return NextResponse.json({
    message: "TeleConnect n8n Webhook Endpoint",
    status: "active",
    timestamp: new Date().toISOString(),
    endpoints: {
      POST: "/api/webhook/n8n - Process customer registration",
    },
  })
}
