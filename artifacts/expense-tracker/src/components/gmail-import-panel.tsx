import React from "react";
import { useGoogleAuth } from "@/lib/google-auth";
import { scanGmail, importSelectedTransactions, getGmailStatus, type ParsedEmailTransaction } from "@/lib/gmail";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownRight, ArrowUpRight, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ScanPhase = "config" | "scanning" | "preview" | "importing";

export function GmailImportPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const { isAuthenticated, accessToken, login } = useGoogleAuth();

  const [phase, setPhase] = React.useState<ScanPhase>("config");
  const [lastSync, setLastSync] = React.useState<Date | null>(null);
  const [scanned, setScanned] = React.useState<ParsedEmailTransaction[]>([]);
  const [totalScanned, setTotalScanned] = React.useState(0);
  const [selectedTempIds, setSelectedTempIds] = React.useState<Set<string>>(new Set());

  const defaultFrom = React.useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split("T")[0];
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
      setSelectedTempIds(new Set(result.transactions.map(t => t.tempId)));
      setPhase("preview");
    } catch {
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
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
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
                            <Checkbox checked={selected} onCheckedChange={() => toggleOne(tx.tempId)} aria-label="Select" />
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
