import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { useEffect } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Insights from "@/pages/insights";
import Accounts from "@/pages/accounts";
import Settings from "@/pages/settings";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    }
  }
});

function LoginPage({ login }: { login: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-md">₹</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SmartTrack</h1>
            <p className="text-xs text-green-600 font-medium">Smart Expense Tracker</p>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-800">Welcome back</h2>
          <p className="text-gray-500 text-sm">Sign in to manage your finances and track expenses automatically from your emails.</p>
        </div>
        <div className="space-y-3">
          <Button onClick={login} className="w-full bg-green-500 hover:bg-green-600 text-white py-3 text-base font-medium rounded-xl">
            Sign in with Replit
          </Button>
          <p className="text-xs text-gray-400">Your data is private and only visible to you.</p>
        </div>
        <div className="pt-4 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-3 text-center">
            {["Auto-import from Gmail", "INR ₹ currency", "Spending insights"].map((feat) => (
              <div key={feat} className="text-xs text-gray-500 bg-green-50 rounded-lg p-2">{feat}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  const { user, isLoading, isAuthenticated, login } = useAuth();

  // Handle URL params from Gmail OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected") === "1") {
      queryClient.invalidateQueries();
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("gmail_error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-green-500 mx-auto" />
          <p className="text-gray-500 text-sm">Loading SmartTrack…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginPage login={login} />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/insights" component={Insights} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
