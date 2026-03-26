import React from "react";
import { 
  useGetInsightsSummary, 
  useGetSpendingByCategory, 
  useGetDailySpending 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Legend
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "week" | "month" | "quarter" | "year";

export default function Insights() {
  const [period, setPeriod] = React.useState<Period>("month");
  
  const { data: summary, isLoading: isLoadingSummary } = useGetInsightsSummary({ period });
  const { data: categoryData, isLoading: isLoadingCats } = useGetSpendingByCategory({ period });
  const { data: dailyData, isLoading: isLoadingDaily } = useGetDailySpending({ period });

  // Default color palette for categories if color isn't provided
  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Insights</h1>
          <p className="text-muted-foreground mt-1">Visualize your financial habits.</p>
        </div>
        
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[180px] bg-card hover-elevate">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoadingSummary ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Total Income</p>
              <h3 className="text-3xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.totalIncome)}
              </h3>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
              <h3 className="text-3xl font-bold mt-2 text-destructive">
                {formatCurrency(summary.totalExpenses)}
              </h3>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Net Savings</p>
              <h3 className="text-3xl font-bold mt-2 text-foreground">
                {formatCurrency(summary.netSavings)}
              </h3>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category Pie Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingCats ? (
              <Skeleton className="h-[300px] w-full" />
            ) : categoryData?.data && categoryData.data.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="amount"
                      nameKey="categoryName"
                    >
                      {categoryData.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.categoryColor || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                No expense data for this period.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Spending Trend */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDaily ? (
              <Skeleton className="h-[300px] w-full" />
            ) : dailyData?.data && dailyData.data.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData.data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).getDate().toString()} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(val) => `₹${val/1000}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => new Date(label as string).toLocaleDateString()}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="hsl(150 60% 40%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="amount" name="Expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                No trend data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
