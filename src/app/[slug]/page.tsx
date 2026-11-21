import React from "react";
import { notFound } from "next/navigation";
import { getPublicSchoolInfoAction } from "@/app/actions/captacao";
import { PublicSchoolPageClient } from "@/components/public/PublicSchoolPageClient";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Lista de palavras reservadas do sistema que nunca devem ser tratadas como slug de instituição
const RESERVED_SLUGS = new Set([
  "app",
  "api",
  "escola",
  "verificar",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "img",
  "_next",
]);

export default async function TenantSlugPage({ params }: PageProps) {
  const { slug } = await params;

  if (!slug || RESERVED_SLUGS.has(slug.toLowerCase())) {
    notFound();
  }

  const res = await getPublicSchoolInfoAction(slug);

  if (res.error || !res.data) {
    notFound();
  }

  return <PublicSchoolPageClient school={res.data} />;
}
