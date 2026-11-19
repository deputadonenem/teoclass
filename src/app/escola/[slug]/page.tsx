import React from "react";
import { notFound } from "next/navigation";
import { getPublicSchoolInfoAction } from "@/app/actions/captacao";
import { PublicSchoolPageClient } from "@/components/public/PublicSchoolPageClient";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PublicSchoolPage({ params }: PageProps) {
  const { slug } = await params;
  const res = await getPublicSchoolInfoAction(slug);

  if (res.error || !res.data) {
    notFound();
  }

  return <PublicSchoolPageClient school={res.data} />;
}
