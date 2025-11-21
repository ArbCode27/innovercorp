import { type NextRequest, NextResponse } from "next/server"

// Test endpoint for webhook functionality
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log("[v0] Test webhook received:", body)

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    return NextResponse.json({
      success: true,
      message: "Test webhook processed successfully",
      receivedData: body,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Test webhook error:", error)

    return NextResponse.json(
      { error: "Test webhook failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "TeleConnect Test Webhook Endpoint",
    status: "active",
    usage: "Send POST request with JSON data to test webhook functionality",
    timestamp: new Date().toISOString(),
  })
}
