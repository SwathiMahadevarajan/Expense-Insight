import { useGetInsightsSummary, useListTransactions } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetInsightsSummary({ period: "month" });
  const { data: txData, isLoading: isLoadingTx } = useListTransactions({ limit: 5 });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your financial overview for this month.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))
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
                <p className="text-xs text-muted-foreground mt-1">
                  Across all accounts
                </p>
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
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {formatCurrency(summary.dailyAverage)} / day
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
                <TrendingUp className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {summary.savingsRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: 20%
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-3">
        {/* Account Balances */}
        <Card className="md:col-span-3 lg:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingSummary ? (
              <Skeleton className="h-40" />
            ) : summary?.accountBalances.length ? (
              summary.accountBalances.map((acc) => (
                <div key={acc.accountId} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border hover:bg-secondary transition-colors cursor-default">
                  <span className="font-medium">{acc.accountName}</span>
                  <span className="font-bold">{formatCurrency(acc.balance)}</span>
                </div>
              ))
            ) : (
              <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground">
                No accounts found.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="md:col-span-4 lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTx ? (
              <Skeleton className="h-64" />
            ) : txData?.transactions.length ? (
              <div className="space-y-4">
                {txData.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-destructive/10 text-destructive'
                      }`}>
                        {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{tx.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{formatDate(tx.date)}</span>
                          {tx.categoryName && (
                            <>
                              <span>•</span>
                              <span>{tx.categoryIcon} {tx.categoryName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold text-base ${tx.type === 'income' ? 'text-emerald-600' : 'text-foreground'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed rounded-xl flex flex-col items-center">
                <Activity className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No recent transactions.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
