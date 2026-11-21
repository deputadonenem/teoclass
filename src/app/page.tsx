"use client";

import React, { useState } from "react";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Benefits } from "@/components/landing/Benefits";
import { TargetAudience } from "@/components/landing/TargetAudience";
import { Pricing } from "@/components/landing/Pricing";
import { Footer } from "@/components/landing/Footer";
import { DemoModal } from "@/components/landing/DemoModal";

export default function HomePage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("Gestão + EAD");

  const handleOpenDemoWithPlan = (planName: string) => {
    setSelectedPlan(planName);
    setDemoOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Topo / Navbar */}
      <Header onOpenDemo={() => setDemoOpen(true)} />

      {/* Hero Section */}
      <main className="flex-1">
        <Hero onOpenDemo={() => setDemoOpen(true)} />
        
        {/* Benefícios e Recursos Principais */}
        <Benefits />

        {/* Para quem é o TeoClass */}
        <TargetAudience />

        {/* Seção de Planos Institucionais */}
        <Pricing onSelectPlan={handleOpenDemoWithPlan} />
      </main>

      {/* Rodapé Institucional */}
      <Footer />

      {/* Modal Interativo para Solicitar Demonstração / Contato */}
      <DemoModal
        isOpen={demoOpen}
        onClose={() => setDemoOpen(false)}
        initialPlan={selectedPlan}
      />
    </div>
  );
}
