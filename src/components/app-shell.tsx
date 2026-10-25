import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Building2,
  Calculator,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  PenLine,
  Scale,
  Settings,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { PwaRoot } from "@/components/pwa";
import { countryByName } from "@/lib/countries";

const GROUPS = [
  {
    label: "Pilotage",
    items: [
      { to: "/", icon: LayoutDashboard, key: "dashboard" as const },
      { to: "/relances", icon: FileText, key: "reminders" as const },
      { to: "/gestion", icon: Calculator, key: "gestion" as const },
      { to: "/analytique", icon: Calculator, key: "analytique" as const },
      { to: "/annexes", icon: BookOpen, key: "annexes" as const },
      { to: "/liasse", icon: Calculator, key: "liasse" as const },
      { to: "/echeances", icon: Calculator, key: "echeances" as const },
      { to: "/cabinet", icon: Building2, key: "cabinet" as const },
    ],
  },
  {
    label: "Comptabilité",
    items: [
      { to: "/saisie", icon: PenLine, key: "journal" as const },
      { to: "/assistant", icon: BookOpen, key: "assistant" as const },
      { to: "/journal", icon: BookOpen, key: "general" as const },
      { to: "/grand-livre", icon: BookOpen, key: "ledger" as const },
      { to: "/balance", icon: Scale, key: "balance" as const },
      { to: "/resultat", icon: Calculator, key: "pnl" as const },
      { to: "/bilan", icon: Landmark, key: "bilan" as const },
      { to: "/immobilisations", icon: Building2, key: "assets" as const },
      { to: "/lettrage", icon: Scale, key: "lettering" as const },
    ],
  },
  {
    label: "Commercial",
    items: [
      { to: "/documents", icon: FileText, key: "documents" as const },
      { to: "/clients", icon: Users, key: "clients" as const },
      { to: "/fournisseurs", icon: Users, key: "suppliers" as const },
      { to: "/articles", icon: Package, key: "articles" as const },
      { to: "/stock", icon: Warehouse, key: "stock" as const },
      { to: "/recurring", icon: FileText, key: "recurring" as const },
    ],
  },
  {
    label: "Trésorerie & fiscal",
    items: [
      { to: "/banque", icon: Wallet, key: "bank" as const },
      { to: "/financements", icon: Wallet, key: "financements" as const },
      { to: "/mobile-money", icon: Wallet, key: "mobileMoney" as const },
      { to: "/tva", icon: Calculator, key: "vat" as const },
      { to: "/impot", icon: Landmark, key: "is" as const },
      { to: "/paie", icon: Users, key: "payroll" as const },
      { to: "/fiscalite", icon: Scale, key: "tax" as const },
    ],
  },
  {
    label: "Référentiel",
    items: [
      { to: "/plan", icon: BookOpen, key: "chart" as const },
      { to: "/parametres", icon: Settings, key: "settings" as const },
      { to: "/guide", icon: BookOpen, key: "guide" as const },
    ],
  },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lang = useAppStore((s) => s.settings.lang);
  return (
    <nav className="flex flex-col gap-6 px-3 pb-8">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
            {g.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm transition-colors duration-150",
                      active
                        ? "bg-elevated text-fg"
                        : "text-muted hover:bg-elevated/60 hover:text-fg",
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                    {t(lang, item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const settings = useAppStore((s) => s.settings);
  const hydrated = useAppStore((s) => s.hydrated);
  const setHydrated = useAppStore((s) => s.setHydrated);
  const tax = countryByName(settings.country);

  useEffect(() => {
    const result = useAppStore.persist.rehydrate();
    if (result instanceof Promise) {
      void result.then(() => setHydrated(true));
    } else {
      setHydrated(true);
    }
  }, [setHydrated]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted">
        <p className="font-display text-lg tracking-tight">PRO COMPTA OHADA</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/favicon.svg" alt="" className="size-9 rounded-[10px]" />
          <div className="min-w-0">
            <p className="font-display text-base font-medium leading-tight tracking-tight">PRO COMPTA</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">OHADA · SYSCOHADA</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Nav />
        </div>
      </aside>

      {open ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-ink/70"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] overflow-y-auto border-r border-border bg-surface">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="font-display text-lg">PRO COMPTA</span>
              <button className="rounded-[8px] p-2" onClick={() => setOpen(false)} aria-label="Fermer">
                <X className="size-5" />
              </button>
            </div>
            <Nav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-3 backdrop-blur-sm sm:px-6">
          <button
            className="rounded-[10px] p-2 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{settings.companyName}</p>
            <p className="truncate text-xs text-muted">
              {settings.country} · {tax.currency} · {settings.fyStart.slice(0, 4)}
            </p>
          </div>
          <PwaRoot />
        </header>
        <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
