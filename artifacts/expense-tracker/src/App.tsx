import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { GoogleAuthProvider } from "@/lib/google-auth";
import { seedDefaultData } from "@/lib/db";
import { scheduleNotifications } from "@/lib/notifications";
import { useNotificationSettings } from "@/hooks/use-local-notifications";

import { AppLayout } from "@/components/layout/app-layout";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Insights from "@/pages/insights";
import Accounts from "@/pages/accounts";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 } }
});

function NotificationScheduler() {
  const { data } = useNotificationSettings();
  useEffect(() => {
    if (data?.notifications) {
      scheduleNotifications(data.notifications);
    }
  }, [data?.notifications]);
  return null;
}

function AppRouter() {
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
  useEffect(() => {
    // Seed default categories on first load
    seedDefaultData().catch(console.error);
  }, []);

  return (
    <GoogleAuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <NotificationScheduler />
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </GoogleAuthProvider>
  );
}

export default App;
