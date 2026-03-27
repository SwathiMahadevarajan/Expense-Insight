import React from "react";
import { useInsightsSummary, useSpendingByCategory, useDailySpending, type InsightPeriod } from "@/hooks/use-local-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Wallet, BarChart2, Table2, PieChart as PieIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Insights() {
  const [period, setPeriod] = React.useState<InsightPeriod>("month");
  const [catView, setCatView] = React.useState<"chart" | "table">("chart");
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

      {/* Spending by Category — with chart/table toggle */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Spending by Category</CardTitle>
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              size="sm" variant="ghost"
              className={`rounded-none h-8 px-3 ${catView === "chart" ? "bg-muted" : ""}`}
              onClick={() => setCatView("chart")}
            >
              <PieIcon className="w-3.5 h-3.5 mr-1.5" /> Chart
            </Button>
            <Button
              size="sm" variant="ghost"
              className={`rounded-none h-8 px-3 border-l ${catView === "table" ? "bg-muted" : ""}`}
              onClick={() => setCatView("table")}
            >
              <Table2 className="w-3.5 h-3.5 mr-1.5" /> Table
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isCatLoading ? <Skeleton className="h-64 rounded-xl" /> : !byCategory?.data.length ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              No expense data for {periodLabel}
            </div>
          ) : catView === "chart" ? (
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
              <div className="space-y-2.5 mt-3 max-h-52 overflow-y-auto pr-1">
                {byCategory.data.map((cat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs w-4 text-right flex-shrink-0">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                      style={{ backgroundColor: `${cat.categoryColor}20`, color: cat.categoryColor }}>
                      {cat.categoryIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium truncate">{cat.categoryName}</span>
                        <span className="text-sm font-semibold ml-2 flex-shrink-0">{formatCurrency(cat.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, backgroundColor: cat.categoryColor }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-9 text-right flex-shrink-0">{cat.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Table view */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Txns</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Avg/txn</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCategory.data.map((cat, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                            style={{ backgroundColor: `${cat.categoryColor}20`, color: cat.categoryColor }}>
                            {cat.categoryIcon}
                          </div>
                          <span className="font-medium text-sm">{cat.categoryName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(cat.amount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground hidden sm:table-cell">{cat.transactionCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                        {cat.transactionCount > 0 ? formatCurrency(cat.amount / cat.transactionCount) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5 hidden sm:block overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.categoryColor }} />
                          </div>
                          <span className="text-sm font-medium" style={{ color: cat.categoryColor }}>
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Totals row */}
              <div className="flex items-center justify-between pt-3 px-4 border-t mt-1">
                <span className="text-sm font-semibold">Total</span>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted-foreground hidden sm:inline">{byCategory.data.reduce((s, c) => s + c.transactionCount, 0)} txns</span>
                  <span className="font-bold">{formatCurrency(byCategory.data.reduce((s, c) => s + c.amount, 0))}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Income vs Expenses bar chart */}
      <Card>
        <CardHeader><CardTitle>Income vs Expenses Over Time</CardTitle></CardHeader>
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
  );
}
