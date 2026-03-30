import React from "react";
import { useInsightsSummary } from "@/hooks/use-local-insights";
import { useTransactions } from "@/hooks/use-local-transactions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GmailImportPanel } from "@/components/gmail-import-panel";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useInsightsSummary("month");
  const { data: txData, isLoading: isLoadingTx } = useTransactions({ limit: 5 });
  const [gmailOpen, setGmailOpen] = React.useState(false);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your financial overview for this month.</p>
        </div>
        <Button
          variant={gmailOpen ? "default" : "outline"}
          size="sm"
          className={gmailOpen ? "bg-green-500 hover:bg-green-600 text-white" : ""}
          onClick={() => setGmailOpen(v => !v)}
        >
          <Mail className="w-4 h-4 mr-2" /> Import from Gmail
        </Button>
      </div>

      {gmailOpen && <GmailImportPanel onClose={() => setGmailOpen(false)} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : summary ? (
          <>
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                <Wallet className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(summary.totalIncome - summary.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(summary.totalIncome)}
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
                <ArrowDownRight className="w-4 h-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(summary.totalExpenses)}
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {summary.savingsRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ₹{summary.dailyAverage.toFixed(0)}/day avg spend
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
        {isLoadingTx ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 mb-2 rounded-xl" />)
        ) : txData?.transactions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>No transactions yet. Add your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {txData?.transactions.map(tx => (
              <Card key={tx.id} className="hover-elevate">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: tx.categoryColor ? `${tx.categoryColor}20` : "#f1f5f9", color: tx.categoryColor ?? "#94a3b8" }}>
                      {tx.categoryIcon ?? (tx.importSource === "email" ? "📧" : "💳")}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
                      <div className="flex gap-2 items-center mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                        {tx.categoryName && (
                          <Badge variant="outline" className="text-[10px] py-0">{tx.categoryName}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`font-bold ${tx.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
