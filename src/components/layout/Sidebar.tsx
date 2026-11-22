"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTenant } from "@/contexts/TenantContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { hasModuleAccess, TeoClassModule, ROLE_DEFINITIONS } from "@/lib/rbac/permissions";
import { hasPlanModuleAccess } from "@/lib/rbac/entitlements";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  Award,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Compass,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  name: string;
  href: string;
  module: TeoClassModule;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Painel Geral",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    module: "inicio",
  },
  {
    name: "Secretaria",
    href: "/app/secretaria",
    icon: Users,
    module: "secretaria",
  },
  {
    name: "Acadêmico",
    href: "/app/academico",
    icon: GraduationCap,
    module: "academico",
  },
  {
    name: "Boletim & Notas",
    href: "/app/academico/boletim",
    icon: Award,
    module: "academico",
  },
  {
    name: "Portal do Aluno",
    href: "/app/portal",
    icon: Compass,
    module: "portal_aluno",
  },
  {
    name: "EAD & Aulas",
    href: "/app/ead",
    icon: BookOpen,
    module: "ead",
  },
  {
    name: "Avaliações & Provas",
    href: "/app/provas",
    icon: Award,
    module: "provas",
  },
  {
    name: "Financeiro",
    href: "/app/financeiro",
    icon: DollarSign,
    module: "financeiro",
  },
  {
    name: "Certificados",
    href: "/app/certificados",
    icon: Award,
    module: "certificados",
  },
  {
    name: "Captação & IA",
    href: "/app/captacao",
    icon: Sparkles,
    module: "captacao",
  },
  {
    name: "Configurações",
    href: "/app/configuracoes",
    icon: Settings,
    module: "configuracoes",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, profile, tenant } = useTenant();
  const { isCollapsed, toggleCollapse, isMobileOpen, closeMobile } = useSidebar();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/app/login");
    router.refresh();
  };

  const roleConfig = role ? ROLE_DEFINITIONS[role] : null;

  // Determina qual item do menu é o mais específico e correspondente à rota atual
  // Evita correspondência ambígua quando um item é prefixo de outro (ex: /app/academico e /app/academico/boletim)
  const activeHref = React.useMemo(() => {
    if (!pathname) return "";

    // Filtra todos os itens que correspondem à rota atual (exata ou prefixo de segmento de rota)
    const matchingItems = NAV_ITEMS.filter((item) => {
      if (pathname === item.href) return true;
      if (pathname.startsWith(`${item.href}/`)) return true;
      return false;
    });

    if (matchingItems.length === 0) return "";

    // Seleciona o item com maior especificidade (maior comprimento de href)
    matchingItems.sort((a, b) => b.href.length - a.href.length);
    return matchingItems[0].href;
  }, [pathname]);

  const renderSidebarContent = (collapsed: boolean, isDrawer = false) => {
    return (
      <div className="flex flex-col h-full select-none justify-between">
        {/* Top Header & Brand */}
        <div>
          <div
            className={clsx(
              "h-16 relative flex items-center border-b border-slate-800 bg-slate-950/80 px-4",
              collapsed ? "justify-center" : "justify-between"
            )}
          >
            <Link
              href="/app/dashboard"
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-900/40 shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="font-bold text-lg tracking-tight text-white leading-none">
                    Teo<span className="text-indigo-400">Class</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
                    SaaS Teológico
                  </span>
                </div>
              )}
            </Link>

            {/* Collapse Button / Close Mobile */}
            {isDrawer ? (
              <button
                type="button"
                onClick={closeMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              !collapsed && (
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Recolher menu"
                  aria-label="Recolher menu"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )
            )}
          </div>

          {/* Desktop Expand Button when Collapsed */}
          {!isDrawer && collapsed && (
            <div className="px-2 pt-2 flex justify-center">
              <button
                type="button"
                onClick={toggleCollapse}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
                title="Expandir menu lateral"
                aria-label="Expandir menu lateral"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            {NAV_ITEMS.map((item) => {
              // 1. Verifica autorização de RBAC do usuário
              const isAllowedByRole = role ? hasModuleAccess(role, item.module) : false;
              if (!isAllowedByRole) return null;

              // 2. Verifica Entitlements do Plano SaaS do Tenant
              const planTier = tenant?.plan_tier || "gestao";
              const isAllowedByPlan = hasPlanModuleAccess(planTier, item.module);
              if (!isAllowedByPlan) return null;

              const isActive = item.href === activeHref;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => isDrawer && closeMobile()}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative",
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon
                    className={clsx(
                      "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Profile & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          {!collapsed && (
            <div className="mb-3 px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {profile?.full_name || "Usuário"}
              </div>
              <div className="text-[10px] text-indigo-400 font-medium">
                {roleConfig?.label || "Perfil TeoClass"}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className={clsx(
              "flex items-center gap-2 rounded-xl text-xs font-medium text-rose-400 hover:text-white hover:bg-rose-950/50 border border-rose-900/30 transition-colors",
              collapsed ? "w-10 h-10 justify-center p-0 mx-auto" : "w-full px-3 py-2"
            )}
            title="Sair do sistema"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sair da conta</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          "hidden lg:flex flex-col shrink-0 bg-slate-950 text-slate-100 border-r border-slate-800 transition-all duration-300 ease-in-out relative overflow-hidden",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {renderSidebarContent(isCollapsed, false)}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={closeMobile}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-950 text-slate-100 h-full shadow-2xl flex flex-col z-10 border-r border-slate-800 animate-in slide-in-from-left duration-200 overflow-hidden">
            {renderSidebarContent(false, true)}
          </aside>
        </div>
      )}
    </>
  );
}
