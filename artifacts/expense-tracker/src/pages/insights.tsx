import React from "react";
import { useInsightsSummary, useSpendingByCategory, useDailySpending, useWeekdaySpending, type InsightPeriod } from "@/hooks/use-local-insights";
import { useTransactions } from "@/hooks/use-local-transactions";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Wallet, BarChart2, Table2, PieChart as PieIcon, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ── Weekday heatmap ─────────────────────────────────────────────────────────

type WeekdayEntry = { day: string; amount: number; count: number };

function WeekdayHeatmap({ data }: { data: WeekdayEntry[] }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  const topDay    = data.reduce((best, d) => d.amount > best.amount ? d : best, data[0]);
  const hasData   = data.some(d => d.amount > 0);

  // Abbreviate amounts: ₹1.2k, ₹85
  const fmt = (n: number) =>
    n === 0 ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {data.map((d) => {
          const ratio  = d.amount / maxAmount;
          const isTop  = hasData && d.day === topDay.day;
          // Red spectrum: very light → deep red
          const alpha  = ratio === 0 ? 0 : 0.10 + ratio * 0.80;
          const bgStyle = ratio === 0
            ? undefined
            : { backgroundColor: `rgba(239, 68, 68, ${alpha})` };

          return (
            <div key={d.day} className="flex flex-col items-center gap-1.5">
              {/* Cell */}
              <div
                className={[
                  "relative w-full rounded-xl flex flex-col items-center justify-center py-2.5 gap-0.5",
                  "transition-transform active:scale-95",
                  ratio === 0 ? "bg-muted/60" : "",
                  isTop ? "ring-2 ring-red-400/70 ring-offset-1" : "",
                ].join(" ")}
                style={bgStyle}
                title={`${d.day}: ${formatCurrency(d.amount)} · ${d.count} txn${d.count !== 1 ? "s" : ""}`}
              >
                {isTop && (
                  <span className="absolute -top-2.5 text-sm leading-none select-none">🔥</span>
                )}
                <span className={[
                  "text-[10px] font-bold leading-none",
                  ratio > 0.55 ? "text-white" : "text-foreground",
                ].join(" ")}>
                  {fmt(d.amount)}
                </span>
                {d.count > 0 && (
                  <span className={[
                    "text-[9px] leading-none",
                    ratio > 0.55 ? "text-white/70" : "text-muted-foreground",
                  ].join(" ")}>
                    {d.count}×
                  </span>
                )}
              </div>
              {/* Day label */}
              <span className={[
                "text-[10px] font-medium",
                isTop ? "text-red-500 font-semibold" : "text-muted-foreground",
              ].join(" ")}>
                {d.day}
              </span>
            </div>
          );
        })}
      </div>

      {hasData ? (
        <div className="flex items-center gap-3 bg-red-50/60 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20 rounded-xl px-3 py-2.5">
          <span className="text-xl leading-none">🔥</span>
          <div>
            <p className="text-sm font-semibold">
              Peak day: <span className="text-red-600 dark:text-red-400">{topDay.day}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(topDay.amount)} across {topDay.count} transaction{topDay.count !== 1 ? "s" : ""}
            </p>
          </div>
          {/* Color legend */}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground">Low</span>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.55, 0.75, 0.92].map((a, i) => (
                <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(239,68,68,${a})` }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">No expense data for this period.</p>
      )}
    </div>
  );
}

type DrillCategory = {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  startDate: Date;
  endDate: Date;
};

type SpendingEntry = {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  transactionCount: number;
  percentage: number;
};

function usePeriodDates(period: InsightPeriod) {
  return React.useMemo(() => {
    const now = new Date();
    let start: Date;
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    switch (period) {
      case "week": start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0,0,0,0); break;
      case "quarter": start = new Date(now); start.setMonth(now.getMonth() - 3); start.setHours(0,0,0,0); break;
      case "year": start = new Date(now.getFullYear(), 0, 1); break;
      default: start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start, end };
  }, [period]);
}

function CategoryDrillDown({ drill, onClose }: { drill: DrillCategory; onClose: () => void }) {
  const isUncategorized = drill.categoryId === null;

  // For categorized: use standard filter. For uncategorized: query manually.
  const categorizedData = useTransactions(
    isUncategorized ? {} :
    { categoryId: drill.categoryId!, startDate: drill.startDate, endDate: drill.endDate, limit: 200 }
  );

  const uncategorizedTxs = useLiveQuery(async () => {
    if (!isUncategorized) return null;
    const all = await db.transactions
      .where("date").between(drill.startDate.toISOString(), drill.endDate.toISOString(), true, true)
      .toArray();
    return all.filter(t => !t.categoryId && t.type === "expense");
  }, [isUncategorized, drill.startDate.toISOString(), drill.endDate.toISOString()]);

  const txs = isUncategorized
    ? (uncategorizedTxs ?? []).map(t => ({ ...t, categoryName: null, categoryColor: null, categoryIcon: null, accountName: null }))
    : (categorizedData.data?.transactions ?? []);

  const isLoading = isUncategorized ? uncategorizedTxs === undefined : categorizedData.isLoading;
  const total = txs.reduce((s, t) => s + t.amount, 0);

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ backgroundColor: `${drill.categoryColor}20`, color: drill.categoryColor }}>
              {drill.categoryIcon}
            </div>
            <div>
              <p className="text-lg font-bold">{drill.categoryName}</p>
              <p className="text-sm text-muted-foreground font-normal">{txs.length} transaction{txs.length !== 1 ? "s" : ""} · {formatCurrency(Math.abs(total))}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-2">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : txs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-10">No transactions in this period.</p>
        ) : (
          <div className="space-y-2">
            {txs.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{tx.description}</p>
                  {tx.merchantName && <p className="text-xs text-muted-foreground truncate">{tx.merchantName}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {tx.type === "income"
                    ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                    : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                  <span className={`font-semibold text-sm ${tx.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Insights() {
  const [period, setPeriod] = React.useState<InsightPeriod>("month");
  const [catView, setCatView] = React.useState<"chart" | "table">("chart");
  const [drill, setDrill] = React.useState<DrillCategory | null>(null);

  const { data: summary, isLoading: isLoadingSummary } = useInsightsSummary(period);
  const { data: byCategory, isLoading: isCatLoading } = useSpendingByCategory(period);
  const { data: daily, isLoading: isDailyLoading } = useDailySpending(period);
  const { data: weekday, isLoading: isWeekdayLoading } = useWeekdaySpending(period);
  const { start, end } = usePeriodDates(period);

  const periodLabel = period === "week" ? "Last 7 days" : period === "month" ? "This month" : period === "quarter" ? "Last 3 months" : "This year";

  const openDrill = (cat: SpendingEntry) => {
    setDrill({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      categoryColor: cat.categoryColor,
      categoryIcon: cat.categoryIcon,
      startDate: start,
      endDate: end,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
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

      {/* KPIs */}
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

      {/* Spending by Category */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Spending by Category</CardTitle>
          <div className="flex rounded-lg border overflow-hidden">
            <Button size="sm" variant="ghost" className={`rounded-none h-8 px-3 ${catView === "chart" ? "bg-muted" : ""}`} onClick={() => setCatView("chart")}>
              <PieIcon className="w-3.5 h-3.5 mr-1.5" /> Chart
            </Button>
            <Button size="sm" variant="ghost" className={`rounded-none h-8 px-3 border-l ${catView === "table" ? "bg-muted" : ""}`} onClick={() => setCatView("table")}>
              <Table2 className="w-3.5 h-3.5 mr-1.5" /> Table
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isCatLoading ? <Skeleton className="h-64 rounded-xl" /> : !byCategory?.data.length ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No expense data for {periodLabel}</div>
          ) : catView === "chart" ? (
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={byCategory.data} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    paddingAngle={3} dataKey="amount"
                    onClick={(entry) => openDrill(entry)}
                    style={{ cursor: "pointer" }}
                  >
                    {byCategory.data.map((entry, i) => (
                      <Cell key={i} fill={entry.categoryColor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 mt-3 max-h-52 overflow-y-auto pr-1">
                {byCategory.data.map((cat, i) => (
                  <button
                    key={i}
                    type="button"
                    className="flex items-center gap-3 w-full hover:bg-muted/40 rounded-lg px-2 py-1 transition-colors text-left group"
                    onClick={() => openDrill(cat)}
                    title="Click to see transactions"
                  >
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
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Txns</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Avg</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCategory.data.map((cat, i) => (
                    <TableRow
                      key={i}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => openDrill(cat)}
                      title="Click to see transactions"
                    >
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
                        <span className="text-sm font-medium" style={{ color: cat.categoryColor }}>{cat.percentage.toFixed(1)}%</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

      {/* Day-of-Week Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <span>Spending by Day of Week</span>
            <span className="text-base leading-none">📅</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">Which days do you spend the most?</p>
        </CardHeader>
        <CardContent>
          {isWeekdayLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ) : weekday ? (
            <WeekdayHeatmap data={weekday} />
          ) : null}
        </CardContent>
      </Card>

      {/* Income vs Expenses */}
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

      {/* Drill-down sheet */}
      {drill && <CategoryDrillDown drill={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}
