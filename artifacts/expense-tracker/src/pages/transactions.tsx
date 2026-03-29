import React from "react";
import { useTransactions, deleteTransaction, bulkDeleteTransactions, bulkUpdateTransactions } from "@/hooks/use-local-transactions";
import { useCategories } from "@/hooks/use-local-categories";
import { useAccounts } from "@/hooks/use-local-accounts";
import { useGoogleAuth } from "@/lib/google-auth";
import { scanGmail, importSelectedTransactions, getGmailStatus, type ParsedEmailTransaction } from "@/lib/gmail";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownRight, ArrowUpRight, Search, Plus, Trash2, Edit2, Download,
  ArrowUpDown, Filter, Mail, RefreshCw, ChevronDown, X, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TransactionDialog } from "@/components/transaction-dialog";

type SortField = "date" | "amount" | "description";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "income" | "expense";
type ScanPhase = "config" | "scanning" | "preview" | "importing";

// ─── Gmail Import Panel ──────────────────────────────────────────────────────

function GmailImportPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const { isAuthenticated, accessToken, login } = useGoogleAuth();

  const [phase, setPhase] = React.useState<ScanPhase>("config");
  const [lastSync, setLastSync] = React.useState<Date | null>(null);
  const [scanned, setScanned] = React.useState<ParsedEmailTransaction[]>([]);
  const [totalScanned, setTotalScanned] = React.useState(0);
  const [selectedTempIds, setSelectedTempIds] = React.useState<Set<string>>(new Set());

  const defaultFrom = React.useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  }, []);
  const [fromDate, setFromDate] = React.useState(defaultFrom);
  const [toDate, setToDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [useRange, setUseRange] = React.useState(false);

  React.useEffect(() => { getGmailStatus().then(s => setLastSync(s.lastSyncAt)); }, []);

  const allSelected = scanned.length > 0 && scanned.every(t => selectedTempIds.has(t.tempId));
  const noneSelected = selectedTempIds.size === 0;

  const toggleAll = () => {
    if (allSelected) setSelectedTempIds(new Set());
    else setSelectedTempIds(new Set(scanned.map(t => t.tempId)));
  };

  const toggleOne = (tempId: string) => {
    setSelectedTempIds(prev => { const s = new Set(prev); s.has(tempId) ? s.delete(tempId) : s.add(tempId); return s; });
  };

  const handleScan = async () => {
    if (!accessToken) { toast({ title: "Sign in with Google first", variant: "destructive" }); return; }
    setPhase("scanning");
    try {
      const opts = useRange ? { fromDate: new Date(fromDate), toDate: new Date(toDate + "T23:59:59") } : {};
      const result = await scanGmail(accessToken, opts);
      setScanned(result.transactions);
      setTotalScanned(result.totalScanned);
      // Pre-select all
      setSelectedTempIds(new Set(result.transactions.map(t => t.tempId)));
      setPhase("preview");
    } catch (e: any) {
      toast({ title: "Scan failed — check your Google permissions", variant: "destructive" });
      setPhase("config");
    }
  };

  const handleImport = async () => {
    const toImport = scanned.filter(t => selectedTempIds.has(t.tempId));
    if (!toImport.length) { toast({ title: "Select at least one transaction" }); return; }
    setPhase("importing");
    try {
      const count = await importSelectedTransactions(toImport);
      toast({ title: `${count} transaction${count !== 1 ? "s" : ""} imported` });
      setLastSync(new Date());
      onClose();
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
      setPhase("preview");
    }
  };

  return (
    <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
      <CardContent className="pt-4 pb-5 space-y-4">

        {/* ── Config / scanning ── */}
        {(phase === "config" || phase === "scanning") && (
          <>
            {!isAuthenticated ? (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">Sign in with Google to import bank transaction emails.</p>
                <Button size="sm" onClick={login} className="bg-white hover:bg-gray-50 text-gray-700 border shadow-sm flex-shrink-0">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-sm text-green-700">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Google connected
                  </span>
                  {lastSync && (
                    <span className="text-xs text-muted-foreground">· last sync {lastSync.toLocaleDateString("en-IN")}</span>
                  )}
                  <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
                    <Checkbox checked={useRange} onCheckedChange={v => setUseRange(!!v)} />
                    Custom date range
                  </label>
                </div>
                {useRange && (
                  <div className="flex gap-3 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-[120px]">
                      <Label className="text-xs">From</Label>
                      <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate} className="text-sm h-8" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[120px]">
                      <Label className="text-xs">To</Label>
                      <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate} max={new Date().toISOString().split("T")[0]} className="text-sm h-8" />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Button onClick={handleScan} disabled={phase === "scanning"} className="bg-green-500 hover:bg-green-600 text-white" size="sm">
                    {phase === "scanning"
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning Gmail…</>
                      : <><RefreshCw className="w-4 h-4 mr-2" /> Scan Gmail</>
                    }
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Preview list ── */}
        {(phase === "preview" || phase === "importing") && (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-sm">
                  {scanned.length === 0
                    ? "No new transactions found"
                    : `${scanned.length} transaction${scanned.length !== 1 ? "s" : ""} found`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalScanned} emails scanned · {selectedTempIds.size} selected
                  {scanned.length > 0 && (
                    <>
                      {" · "}
                      <button type="button" className="text-green-600 hover:underline" onClick={toggleAll}>
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPhase("config")}>← Back</Button>
                {scanned.length > 0 && (
                  <Button
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white"
                    onClick={handleImport}
                    disabled={noneSelected || phase === "importing"}
                  >
                    {phase === "importing"
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</>
                      : `Import selected (${selectedTempIds.size})`
                    }
                  </Button>
                )}
              </div>
            </div>

            {scanned.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No new bank transaction emails found in this range. Try a wider date range.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden bg-white dark:bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="hidden sm:table-cell text-muted-foreground">Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanned.map(tx => {
                      const selected = selectedTempIds.has(tx.tempId);
                      return (
                        <TableRow
                          key={tx.tempId}
                          className={`cursor-pointer ${selected ? "bg-green-50/60 dark:bg-green-950/10" : "opacity-60"}`}
                          onClick={() => toggleOne(tx.tempId)}
                        >
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleOne(tx.tempId)}
                              aria-label="Select"
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm truncate max-w-[220px]">
                              {tx.merchantName ?? tx.description}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[220px]">{tx.subject}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {tx.type === "income"
                                ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                                : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                              <span className={`font-semibold text-sm ${tx.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                                {formatCurrency(tx.amount)}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Transactions Page ───────────────────────────────────────────────────

export default function Transactions() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [sortField, setSortField] = React.useState<SortField>("date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const { data, isLoading } = useTransactions({ limit: 500 });
  const { data: categoriesData } = useCategories();
  const { data: accountsData } = useAccounts();

  const [txToEdit, setTxToEdit] = React.useState<any>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [gmailOpen, setGmailOpen] = React.useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortedFiltered = React.useMemo(() => {
    let txs = data?.transactions ?? [];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      txs = txs.filter(tx =>
        tx.description.toLowerCase().includes(q) ||
        tx.merchantName?.toLowerCase().includes(q) ||
        tx.categoryName?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") txs = txs.filter(tx => tx.type === typeFilter);
    return [...txs].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else cmp = a.description.localeCompare(b.description);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, searchTerm, typeFilter, sortField, sortDir]);

  const totalShown = sortedFiltered.reduce(
    (acc, tx) => { if (tx.type === "income") acc.income += tx.amount; else acc.expense += tx.amount; return acc; },
    { income: 0, expense: 0 }
  );

  const allSelected = sortedFiltered.length > 0 && sortedFiltered.every(tx => selectedIds.has(tx.id));
  const someSelected = selectedIds.size > 0;
  const toggleAll = () => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(sortedFiltered.map(tx => tx.id))); };
  const toggleOne = (id: string) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await deleteTransaction(id);
    toast({ title: "Deleted" });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} transaction${selectedIds.size !== 1 ? "s" : ""}?`)) return;
    await bulkDeleteTransactions([...selectedIds]);
    setSelectedIds(new Set());
    toast({ title: `Deleted ${selectedIds.size} transactions` });
  };

  const handleBulkSetCategory = async (categoryId: string) => {
    await bulkUpdateTransactions([...selectedIds], { categoryId: categoryId || null });
    toast({ title: `Category updated for ${selectedIds.size} transactions` });
    setSelectedIds(new Set());
  };

  const handleBulkSetAccount = async (accountId: string) => {
    await bulkUpdateTransactions([...selectedIds], { accountId: accountId || null });
    toast({ title: `Account updated for ${selectedIds.size} transactions` });
    setSelectedIds(new Set());
  };

  const handleExportCSV = () => {
    const rows = [
      ["Date", "Description", "Merchant", "Category", "Account", "Type", "Amount (₹)"],
      ...sortedFiltered.map(tx => [
        tx.date.split("T")[0], tx.description, tx.merchantName ?? "",
        tx.categoryName ?? "", tx.accountName ?? "", tx.type, tx.amount.toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `smarttrack-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `Exported ${sortedFiltered.length} transactions` });
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort(field)}>
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-green-500" : "text-muted-foreground/50"}`} />
    </button>
  );

  const categories = categoriesData?.categories ?? [];
  const accounts = accountsData?.accounts ?? [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={gmailOpen ? "default" : "outline"} size="sm"
            className={gmailOpen ? "bg-green-500 hover:bg-green-600 text-white" : ""}
            onClick={() => setGmailOpen(v => !v)}
          >
            <Mail className="w-4 h-4 mr-2" /> Import from Gmail
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => { setTxToEdit(null); setIsAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      {/* Gmail Import Panel */}
      {gmailOpen && <GmailImportPanel onClose={() => setGmailOpen(false)} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/60 border rounded-xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Category <ChevronDown className="w-3.5 h-3.5 ml-1.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
              <DropdownMenuItem onClick={() => handleBulkSetCategory("")}>— None</DropdownMenuItem>
              {categories.map(cat => (
                <DropdownMenuItem key={cat.id} onClick={() => handleBulkSetCategory(cat.id)}>{cat.icon} {cat.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Account <ChevronDown className="w-3.5 h-3.5 ml-1.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleBulkSetAccount("")}>— None</DropdownMenuItem>
              {accounts.map(acc => (
                <DropdownMenuItem key={acc.id} onClick={() => handleBulkSetAccount(acc.id)}>{acc.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto">
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Totals */}
      {!someSelected && sortedFiltered.length > 0 && (
        <div className="flex gap-4 text-sm px-1">
          <span className="text-muted-foreground">{sortedFiltered.length} shown</span>
          {totalShown.income > 0 && <span className="text-emerald-600 font-medium">+{formatCurrency(totalShown.income)}</span>}
          {totalShown.expense > 0 && <span className="text-red-500 font-medium">−{formatCurrency(totalShown.expense)}</span>}
        </div>
      )}

      {/* Transaction Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({length: 5}).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />)}
        </div>
      ) : !sortedFiltered.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {searchTerm || typeFilter !== "all" ? "No transactions match your filters." : "No transactions yet. Add your first one!"}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead><SortBtn field="description" label="Description" /></TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell"><SortBtn field="date" label="Date" /></TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead className="text-right"><SortBtn field="amount" label="Amount" /></TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFiltered.map(tx => {
                const isSelected = selectedIds.has(tx.id);
                return (
                  <TableRow key={tx.id} className={`group ${isSelected ? "bg-green-50/60 dark:bg-green-950/10" : ""}`}>
                    <TableCell>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(tx.id)} aria-label="Select row" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                          style={{ backgroundColor: tx.categoryColor ? `${tx.categoryColor}20` : "#f1f5f9", color: tx.categoryColor ?? "#94a3b8" }}>
                          {tx.categoryIcon ?? (tx.importSource === "email" ? "📧" : "💳")}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{tx.description}</p>
                          {tx.merchantName && <p className="text-xs text-muted-foreground truncate">{tx.merchantName}</p>}
                          <p className="text-xs text-muted-foreground sm:hidden">{formatDate(tx.date)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {tx.categoryName && <Badge variant="outline" className="text-xs">{tx.categoryName}</Badge>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(tx.date)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{tx.accountName ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {tx.type === "income"
                          ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                          : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                        <span className={`font-semibold text-sm ${tx.type === "income" ? "text-emerald-600" : "text-red-500"}`}>
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setTxToEdit(tx); setIsAddOpen(true); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(tx.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <TransactionDialog open={isAddOpen} onOpenChange={setIsAddOpen} transactionToEdit={txToEdit} />
    </div>
  );
}
