export type Gender = "male" | "female" | "other" | "uninformed";

export type Kinship = "pai" | "mae" | "conjuge" | "tutor" | "outro";

export interface Student {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  rg_issuer: string | null;
  birth_date: string | null;
  gender: Gender | null;
  photo_url: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  // Campos Eclesiásticos / Teológicos (Opcionais)
  church_name: string | null;
  pastor_name: string | null;
  ministry_role: string | null;
  general_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  guardians?: StudentGuardianLink[];
}

export interface Guardian {
  id: string;
  tenant_id: string;
  name: string;
  cpf: string;
  rg: string | null;
  kinship: Kinship;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  profession: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentGuardianLink {
  id: string;
  tenant_id: string;
  student_id: string;
  guardian_id: string;
  kinship: Kinship;
  is_financial: boolean;
  is_emergency_contact: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  guardian?: Guardian;
}

export interface StudentInput {
  first_name: string;
  last_name: string;
  cpf?: string | null;
  rg?: string | null;
  rg_issuer?: string | null;
  birth_date?: string | null;
  gender?: Gender | null;
  photo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  postal_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  church_name?: string | null;
  pastor_name?: string | null;
  ministry_role?: string | null;
  general_notes?: string | null;
  is_active?: boolean;
}
