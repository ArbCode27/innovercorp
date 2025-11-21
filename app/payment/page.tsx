import React from "react";
// import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClientsPayForm } from "@/components/organisms/clientsPay/ClientsPayForm";
import { FeatureSection } from "@/components/organisms/clientsPay/FeatureSection";
import { Footer } from "react-day-picker";
import { Testimonials } from "@/components/organisms/clientsPay/Testimonials";
import { Header } from "@/components/molecules/layout/Header";

const page = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />
      {/* Hero Section */}
      <ClientsPayForm />

      {/* Features Section */}
      <FeatureSection />

      {/* Testimonials Section */}
      <Testimonials />
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default page;
