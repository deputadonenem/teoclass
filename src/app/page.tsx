"use client";

import React, { useState } from "react";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Benefits } from "@/components/landing/Benefits";
import { TargetAudience } from "@/components/landing/TargetAudience";
import { Pricing } from "@/components/landing/Pricing";
import { Footer } from "@/components/landing/Footer";
import { TrialRegistrationModal } from "@/components/landing/TrialRegistrationModal";

export default function HomePage() {
  const [trialOpen, setTrialOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("Gestão + EAD");

  const handleOpenTrialWithPlan = (planName: string) => {
    setSelectedPlan(planName);
    setTrialOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Topo / Navbar */}
      <Header onOpenDemo={() => setTrialOpen(true)} />

      {/* Hero Section */}
      <main className="flex-1">
        <Hero onOpenDemo={() => setTrialOpen(true)} />
        
        {/* Benefícios e Recursos Principais */}
        <Benefits />

        {/* Para quem é o TeoClass */}
        <TargetAudience />

        {/* Seção de Planos Institucionais */}
        <Pricing onSelectPlan={handleOpenTrialWithPlan} />
      </main>

      {/* Rodapé Institucional */}
      <Footer />

      {/* Modal Interativo para Cadastro do Teste Grátis de 7 Dias */}
      <TrialRegistrationModal
        isOpen={trialOpen}
        onClose={() => setTrialOpen(false)}
        initialPlan={selectedPlan}
      />
    </div>
  );
}
