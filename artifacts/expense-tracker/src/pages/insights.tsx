import React from "react";
import { useInsightsSummary, useSpendingByCategory, useDailySpending, type InsightPeriod } from "@/hooks/use-local-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Wallet, BarChart2 } from "lucide-react";

export default function Insights() {
  const [period, setPeriod] = React.useState<InsightPeriod>("month");
  const { data: summary, isLoading: isLoadingSummary } = useInsightsSummary(period);
  const { data: byCategory, isLoading: isCatLoading } = useSpendingByCategory(period);
  const { data: daily, isLoading: isDailyLoading } = useDailySpending(period);

  const periodLabel = period === "week" ? "Last 7 days" : period === "month" ? "This month" : period === "quarter" ? "Last 3 months" : "This year";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
          <p className="text-muted-foreground mt-1">Analyse your spending patterns.</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as InsightPeriod)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="quarter">Last 3 months</SelectItem>
            <SelectItem value="year">This year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoadingSummary ? Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />) : summary ? (
          <>
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 hover-elevate">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-green-700">Total Income</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-700">{formatCurrency(summary.totalIncome)}</div></CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 hover-elevate">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-red-700">Total Expenses</CardTitle>
                <TrendingDown className="w-4 h-4 text-red-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-red-700">{formatCurrency(summary.totalExpenses)}</div></CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 hover-elevate">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-blue-700">Net Savings</CardTitle>
                <Wallet className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${summary.netSavings >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(summary.netSavings)}</div>
                <p className="text-xs text-muted-foreground">{summary.savingsRate.toFixed(1)}% savings rate</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.dailyAverage)}</div>
                <p className="text-xs text-muted-foreground">{summary.transactionCount} transactions</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Spending by category pie */}
        <Card>
          <CardHeader><CardTitle>Spending by Category</CardTitle></CardHeader>
          <CardContent>
            {isCatLoading ? <Skeleton className="h-64 rounded-xl" /> : !byCategory?.data.length ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No expense data for {periodLabel}</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byCategory.data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="amount">
                      {byCategory.data.map((entry, i) => (
                        <Cell key={i} fill={entry.categoryColor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-1">
                  {byCategory.data.slice(0, 8).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.categoryColor }} />
                        <span className="truncate max-w-[120px]">{cat.categoryIcon} {cat.categoryName}</span>
                      </div>
                      <div className="flex gap-2 items-center flex-shrink-0">
                        <span className="font-medium">{formatCurrency(cat.amount)}</span>
                        <span className="text-muted-foreground text-xs">{cat.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily spending bar */}
        <Card>
          <CardHeader><CardTitle>Income vs Expenses</CardTitle></CardHeader>
          <CardContent>
            {isDailyLoading ? <Skeleton className="h-64 rounded-xl" /> : !daily?.data.length ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No data for {periodLabel}</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={daily.data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="amount" name="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
