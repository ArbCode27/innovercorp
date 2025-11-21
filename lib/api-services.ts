// Mock Wispro API integration
export interface WisproCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  cedula: string;
  createdAt: string;
}

export interface WisproContract {
  id: string;
  customerId: string;
  plan: string;
  status: "active" | "pending" | "cancelled";
  startDate: string;
  monthlyFee: number;
}

export interface NotificationPayload {
  type: "whatsapp" | "email" | "telegram";
  recipient: string;
  message: string;
  customerName: string;
}

// Mock Wispro API functions
export class WisproAPI {
  private static baseUrl =
    process.env.WISPRO_API_URL || "https://api.wispro.com";
  private static apiKey = process.env.WISPRO_API_KEY || "demo-api-key";

  static async createCustomer(customerData: {
    fullName: string;
    cedula: string;
    address: string;
    phone: string;
    email?: string;
  }): Promise<WisproCustomer> {
    // Simulate API call
    console.log("[v0] Creating customer in Wispro:", customerData);

    // Mock response
    const customer: WisproCustomer = {
      id: `cust_${Date.now()}`,
      name: customerData.fullName,
      email: customerData.email || `${customerData.cedula}@temp.com`,
      phone: customerData.phone,
      address: customerData.address,
      cedula: customerData.cedula,
      createdAt: new Date().toISOString(),
    };

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return customer;
  }

  static async createContract(contractData: {
    customerId: string;
    plan: string;
  }): Promise<WisproContract> {
    console.log("[v0] Creating contract in Wispro:", contractData);

    const planPrices = {
      basico: 29.99,
      premium: 49.99,
      empresarial: 79.99,
      ultra: 129.99,
    };

    const contract: WisproContract = {
      id: `cont_${Date.now()}`,
      customerId: contractData.customerId,
      plan: contractData.plan,
      status: "pending",
      startDate: new Date().toISOString(),
      monthlyFee:
        planPrices[contractData.plan as keyof typeof planPrices] || 29.99,
    };

    await new Promise((resolve) => setTimeout(resolve, 800));

    return contract;
  }
}

// Notification service
export class NotificationService {
  static async sendWhatsApp(phone: string, message: string): Promise<boolean> {
    console.log("[v0] Sending WhatsApp to:", phone, "Message:", message);
    // Mock WhatsApp API integration
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true;
  }

  static async sendEmail(
    email: string,
    subject: string,
    message: string
  ): Promise<boolean> {
    console.log(
      "[v0] Sending email to:",
      email,
      "Subject:",
      subject,
      "Message:",
      message
    );
    // Mock email service integration
    await new Promise((resolve) => setTimeout(resolve, 600));
    return true;
  }

  static async sendTelegram(chatId: string, message: string): Promise<boolean> {
    console.log("[v0] Sending Telegram to:", chatId, "Message:", message);
    // Mock Telegram API integration
    await new Promise((resolve) => setTimeout(resolve, 400));
    return true;
  }

  static async sendConfirmation(
    payload: NotificationPayload
  ): Promise<boolean> {
    switch (payload.type) {
      case "whatsapp":
        return await this.sendWhatsApp(payload.recipient, payload.message);
      case "email":
        return await this.sendEmail(
          payload.recipient,
          "Confirmación de Registro - TeleConnect",
          payload.message
        );
      case "telegram":
        return await this.sendTelegram(payload.recipient, payload.message);
      default:
        return false;
    }
  }
}

//Real Data
