import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Wallet,
  Settings,
  Plus,
  Share,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TransactionDialog } from "../transaction-dialog";

const NAV_ITEMS = [
  { href: "/",             label: "Dashboard",    mobileLabel: "Home",     icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", mobileLabel: "Txns",     icon: ArrowLeftRight  },
  { href: "/insights",     label: "Insights",     mobileLabel: "Insights", icon: PieChart        },
  { href: "/accounts",     label: "Accounts",     mobileLabel: "Accounts", icon: Wallet          },
  { href: "/settings",     label: "Settings",     mobileLabel: "Settings", icon: Settings        },
];

// ── iOS PWA install banner ────────────────────────────────────────────────
function IOSInstallBanner() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isIOS && !isStandalone) {
      const dismissed = sessionStorage.getItem("ios-install-dismissed");
      if (!dismissed) setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="md:hidden fixed bottom-20 left-3 right-3 z-40 bg-card border rounded-2xl shadow-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
      <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
        <Wallet className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Install SmartTrack</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Tap the <Share className="inline w-3.5 h-3.5 mb-0.5" /> <strong>Share</strong> button
          then <strong>"Add to Home Screen"</strong> to install the app.
        </p>
      </div>
      <button
        type="button"
        className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1"
        onClick={() => {
          sessionStorage.setItem("ios-install-dismissed", "1");
          setVisible(false);
        }}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isTxDialogOpen, setIsTxDialogOpen] = React.useState(false);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location === href;

  return (
    <div className="min-h-screen bg-background flex w-full">

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card shadow-sm z-10 sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">SmartTrack</span>
        </div>

        <div className="px-4 pb-4">
          <Button
            className="w-full hover-elevate shadow-md shadow-primary/20"
            size="lg"
            onClick={() => setIsTxDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Transaction
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1 p-4">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}>
                <span className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer",
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Mobile Header — minimal branding + quick-add */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card/95 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Wallet className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">SmartTrack</span>
          </div>
          <Button
            size="sm"
            className="rounded-full px-4 h-9 shadow-md shadow-primary/20"
            onClick={() => setIsTxDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add
          </Button>
        </header>

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <div className="flex-1 overflow-y-auto p-4 pb-28 md:pb-8 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t">
        <div className="flex items-stretch h-16">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <span className={cn(
                  "relative flex flex-col items-center justify-center h-full gap-1 cursor-pointer transition-all",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  {/* Active indicator bar */}
                  {active && (
                    <span className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                  <item.icon
                    className={cn("w-[22px] h-[22px] transition-transform", active && "scale-110")}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  <span className="text-[10px] font-medium leading-none tracking-wide">
                    {item.mobileLabel}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        {/* iOS home-indicator safe area */}
        <div className="bg-card/95" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </nav>

      <TransactionDialog open={isTxDialogOpen} onOpenChange={setIsTxDialogOpen} />
      <IOSInstallBanner />
    </div>
  );
}
