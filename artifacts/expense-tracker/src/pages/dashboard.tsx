import React from "react";
import { Link } from "wouter";
import { useMonthSummary } from "@/hooks/use-local-insights";
import { useTransactions } from "@/hooks/use-local-transactions";
import { useAccounts } from "@/hooks/use-local-accounts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, Mail,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GmailImportPanel } from "@/components/gmail-import-panel";

// ── helpers ─────────────────────────────────────────────────────────────────

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = React.useState<Date>(startOfMonth(today));
  const [gmailOpen, setGmailOpen]         = React.useState(false);

  const isCurrentMonth = isSameMonth(selectedMonth, today);

  const prevMonth = () => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => {
    if (!isCurrentMonth) setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };

  const { data: accountsData, isLoading: isLoadingAccounts } = useAccounts();
  const accounts = accountsData?.accounts ?? [];
  const netWorth = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  const { data: summary, isLoading: isLoadingSummary } = useMonthSummary(selectedMonth);

  const { data: txData, isLoading: isLoadingTx } = useTransactions({
    startDate: startOfMonth(selectedMonth),
    endDate:   endOfMonth(selectedMonth),
    limit:     50,
  });

  const monthLabel = selectedMonth.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const monthShort = selectedMonth.toLocaleString("en-IN", { month: "short",  year: "numeric" });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{monthLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Gmail import */}
          <Button
            variant={gmailOpen ? "default" : "outline"}
            size="sm"
            className={gmailOpen ? "bg-green-500 hover:bg-green-600 text-white" : ""}
            onClick={() => setGmailOpen(v => !v)}
          >
            <Mail className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Import Gmail</span>
          </Button>

          {/* Month navigation */}
          <div className="flex items-center gap-0.5 bg-muted/60 rounded-xl p-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-semibold min-w-[72px] text-center px-1 tabular-nums">
              {monthShort}
            </span>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
              onClick={nextMonth} disabled={isCurrentMonth}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Gmail panel */}
      {gmailOpen && <GmailImportPanel onClose={() => setGmailOpen(false)} />}

      {/* ── Net Worth Banner ───────────────────────────────────── */}
      {isLoadingAccounts ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : (
        <Card className="overflow-hidden border-primary/20">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Net Worth
                </p>
                <div className={`text-3xl font-bold mt-0.5 ${netWorth >= 0 ? "text-foreground" : "text-destructive"}`}>
                  {formatCurrency(netWorth)}
                </div>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${netWorth >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                {netWorth >= 0
                  ? <TrendingUp className="w-5 h-5 text-primary" />
                  : <TrendingDown className="w-5 h-5 text-destructive" />}
              </div>
            </div>

            {accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">
                Add accounts to track your net worth.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {accounts.map(acc => (
                  <div
                    key={acc.id}
                    className="flex items-center gap-1.5 bg-white/60 dark:bg-black/20 rounded-lg px-2 py-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                    <span className="text-[11px] font-medium text-muted-foreground">{acc.name}</span>
                    <span className={`text-[11px] font-bold ${acc.currentBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {formatCurrency(acc.currentBalance)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Summary Cards ──────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {isLoadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : summary ? (
          <>
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 hover-elevate col-span-2 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Net Balance</CardTitle>
                <Wallet className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.totalIncome - summary.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary.savingsRate.toFixed(1)}% saved
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Income</CardTitle>
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(summary.totalIncome)}
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Expenses</CardTitle>
                <ArrowDownRight className="w-4 h-4 text-destructive" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold text-destructive">
                  {formatCurrency(summary.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ₹{summary.dailyAverage.toFixed(0)}/day avg
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Top Category</CardTitle>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {summary.topCategory ? (
                  <>
                    <div className="text-sm font-bold truncate">{summary.topCategory}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(summary.topCategoryAmount ?? 0)}
                    </p>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* ── Month Transactions ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">
            {monthLabel} · {txData?.total ?? 0} transactions
          </h2>
          {(txData?.total ?? 0) > 0 && (
            <Link href="/transactions">
              <span className="text-xs text-primary cursor-pointer font-medium hover:underline">
                See all →
              </span>
            </Link>
          )}
        </div>

        {isLoadingTx ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] mb-2 rounded-2xl" />
          ))
        ) : !txData?.transactions.length ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No transactions in {monthLabel}.
              {isCurrentMonth && (
                <p className="mt-1 text-xs">Add one with the <strong>Add</strong> button above.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {txData.transactions.map(tx => (
              <Card key={tx.id} className="hover-elevate overflow-hidden">
                <CardContent className="flex items-center gap-3 p-3">
                  {/* Category icon */}
                  <div
                    className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-lg"
                    style={{
                      backgroundColor: tx.categoryColor ? `${tx.categoryColor}20` : "#f1f5f9",
                      color: tx.categoryColor ?? "#94a3b8",
                    }}
                  >
                    {tx.categoryIcon ?? (tx.importSource === "email" ? "📧" : "💳")}
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate leading-tight">{tx.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                      {tx.categoryName && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5">
                          {tx.categoryName}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {tx.type === "income"
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                    <span className={`font-bold text-sm ${tx.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Month total strip */}
            {txData.total > 0 && summary && (
              <div className="flex justify-between items-center px-1 pt-2 pb-1 text-xs text-muted-foreground border-t mt-3">
                <span>{txData.total} transactions</span>
                <div className="flex gap-4">
                  <span className="text-emerald-600 font-medium">
                    +{formatCurrency(summary.totalIncome)}
                  </span>
                  <span className="text-red-500 font-medium">
                    −{formatCurrency(summary.totalExpenses)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
