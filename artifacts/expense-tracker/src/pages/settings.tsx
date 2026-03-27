import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Edit2, Plus, Bell, Tags, Mail, CheckCircle2, XCircle, RefreshCw, LogOut, Download, Upload, Smartphone, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGoogleAuth } from "@/lib/google-auth";
import { syncGmail, getGmailStatus } from "@/lib/gmail";
import { exportBackup, importBackup } from "@/lib/db";
import { requestNotificationPermission, sendLocalNotification } from "@/lib/notifications";
import { useCategories, createCategory, updateCategory, deleteCategory } from "@/hooks/use-local-categories";
import { useNotificationSettings, createNotification, updateNotification, deleteNotification } from "@/hooks/use-local-notifications";
import type { Category, NotificationSetting } from "@/lib/db";

export default function Settings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <Tabs defaultValue="gmail" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-3">
          <TabsTrigger value="gmail"><Mail className="w-4 h-4 mr-1.5 hidden sm:inline" /> Gmail</TabsTrigger>
          <TabsTrigger value="categories"><Tags className="w-4 h-4 mr-1.5 hidden sm:inline" /> Categories</TabsTrigger>
          <TabsTrigger value="general"><Smartphone className="w-4 h-4 mr-1.5 hidden sm:inline" /> General</TabsTrigger>
        </TabsList>
        <TabsContent value="gmail" className="mt-6 space-y-4">
          <GmailSection />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesSection />
        </TabsContent>
        <TabsContent value="general" className="mt-6 space-y-4">
          <BackupSection />
          <NotificationsSection />
          <PWASection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OAuthSetupGuide() {
  const [open, setOpen] = React.useState(false);
  const steps = [
    { n: 1, title: "Open Google Cloud Console", body: "console.cloud.google.com — sign in with your Google account." },
    { n: 2, title: "Create a project", body: 'Project dropdown → New Project → name it "SmartTrack" → Create.' },
    { n: 3, title: "Enable Gmail API", body: 'APIs & Services → Library → search "Gmail API" → Enable.' },
    { n: 4, title: "Configure OAuth consent screen", body: 'APIs & Services → OAuth consent screen → External → fill App name + email → add scope gmail.readonly.' },
    { n: 5, title: "Create OAuth client", body: 'Credentials → + Create Credentials → OAuth client ID → Web application.' },
    { n: 6, title: "Add Authorized JS origin", body: "Paste your app URL (from browser address bar, no trailing slash)." },
    { n: 7, title: "Copy Client ID", body: 'Copy the value ending in .apps.googleusercontent.com.' },
    { n: 8, title: "Set VITE_GOOGLE_CLIENT_ID secret", body: 'Replit Secrets panel → create VITE_GOOGLE_CLIENT_ID → paste ID → restart app.' },
  ];
  return (
    <div className="border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          How to set up Google OAuth (free)
        </span>
        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Free forever</Badge>
      </button>
      {open && (
        <div className="px-4 pb-5 pt-2 border-t space-y-4">
          <ol className="space-y-3">
            {steps.map(s => (
              <li key={s.n} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[11px] font-bold flex-shrink-0 flex items-center justify-center mt-0.5">{s.n}</span>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> Open Google Cloud Console
          </a>
        </div>
      )}
    </div>
  );
}

function GmailSection() {
  const { toast } = useToast();
  const { isAuthenticated, accessToken, login, logout, user } = useGoogleAuth();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState<Date | null>(null);
  const [syncResult, setSyncResult] = React.useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const defaultFrom = new Date(); defaultFrom.setMonth(defaultFrom.getMonth() - 1);
  const [fromDate, setFromDate] = React.useState(defaultFrom.toISOString().split("T")[0]);
  const [toDate, setToDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [useCustomRange, setUseCustomRange] = React.useState(false);

  React.useEffect(() => { getGmailStatus().then(s => setLastSync(s.lastSyncAt)); }, []);

  const handleSync = async () => {
    if (!accessToken) { toast({ title: "Sign in with Google first", variant: "destructive" }); return; }
    setIsSyncing(true); setSyncResult(null);
    try {
      const opts = useCustomRange ? { fromDate: new Date(fromDate), toDate: new Date(toDate + "T23:59:59") } : {};
      const result = await syncGmail(accessToken, opts);
      setLastSync(new Date()); setSyncResult(result);
      toast({ title: `${result.imported} transaction${result.imported !== 1 ? "s" : ""} imported` });
    } catch { toast({ title: "Sync failed", variant: "destructive" }); }
    finally { setIsSyncing(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-green-500" /> Gmail Auto-Import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAuthenticated ? (
          <div className="space-y-3">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
              <XCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm font-medium">Sign in with Google to start importing transactions</p>
            </div>
            <Button onClick={login} className="bg-white hover:bg-gray-50 text-gray-700 border shadow-sm w-full">
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
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex gap-3 items-center">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {user?.picture && <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />}
                  <p className="font-medium text-green-800 text-sm">{user?.name ?? "Connected"}</p>
                  <p className="text-green-700 text-xs">{user?.email}</p>
                </div>
                {lastSync && <p className="text-green-700 text-xs mt-0.5">Last sync: {lastSync.toLocaleString("en-IN")}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={logout} className="text-red-500 hover:text-red-600 flex-shrink-0">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <button type="button" onClick={() => setUseCustomRange(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
                <span>Custom date range</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${useCustomRange ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {useCustomRange ? "On" : "Off"}
                </span>
              </button>
              {useCustomRange && (
                <div className="px-4 pb-4 pt-1 border-t">
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">From</Label>
                      <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">To</Label>
                      <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate} max={new Date().toISOString().split("T")[0]} className="text-sm" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {syncResult && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-700">{syncResult.imported}</p>
                    <p className="text-xs text-blue-600">imported</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{syncResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">skipped</p>
                  </div>
                  {syncResult.errors > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{syncResult.errors}</p>
                      <p className="text-xs text-red-500">errors</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleSync} disabled={isSyncing} className="bg-green-500 hover:bg-green-600 text-white w-full">
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Scanning Gmail…" : useCustomRange ? `Sync ${fromDate} → ${toDate}` : "Sync Gmail Now"}
            </Button>
          </div>
        )}
        <OAuthSetupGuide />
      </CardContent>
    </Card>
  );
}

function BackupSection() {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const handleExport = async () => {
    try { await exportBackup(); toast({ title: "Backup downloaded" }); }
    catch { toast({ title: "Export failed", variant: "destructive" }); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsImporting(true);
    try {
      const result = await importBackup(file);
      toast({ title: `Restored: ${result.transactions} transactions, ${result.accounts} accounts` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Backup & Restore</CardTitle></CardHeader>
      <CardContent className="flex gap-3">
        <Button variant="outline" onClick={handleExport} className="flex-1">
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex-1">
          <Upload className="w-4 h-4 mr-2" /> {isImporting ? "Restoring…" : "Restore"}
        </Button>
        <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
      </CardContent>
    </Card>
  );
}

function PWASection() {
  const { toast } = useToast();
  const [notifPermission, setNotifPermission] = React.useState(
    "Notification" in window ? Notification.permission : "not-supported"
  );
  const handleNotifPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(Notification.permission);
    if (granted) {
      toast({ title: "Notifications enabled!" });
      sendLocalNotification("Notifications enabled", "You'll receive expense reminders here.");
    } else {
      toast({ title: "Notifications blocked — enable in browser settings", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-green-500" /> Install as App</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="font-semibold text-blue-800 text-sm mb-1">📱 iOS</p>
            <ol className="text-blue-700 text-xs space-y-1 list-decimal list-inside">
              <li>Open in Safari</li><li>Tap Share → Add to Home Screen</li><li>Tap Add</li>
            </ol>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="font-semibold text-green-800 text-sm mb-1">🤖 Android</p>
            <ol className="text-green-700 text-xs space-y-1 list-decimal list-inside">
              <li>Open in Chrome</li><li>Tap 3-dot menu</li><li>Install App</li>
            </ol>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">Push Notifications</p>
            <Badge variant={notifPermission === "granted" ? "default" : "secondary"}
              className={`mt-1 ${notifPermission === "granted" ? "bg-green-500" : ""}`}>
              {notifPermission === "granted" ? "Enabled" : notifPermission === "denied" ? "Blocked" : "Not set"}
            </Badge>
          </div>
          {notifPermission !== "granted" && notifPermission !== "not-supported" && (
            <Button size="sm" onClick={handleNotifPermission} className="bg-green-500 hover:bg-green-600 text-white flex-shrink-0">
              <Bell className="w-4 h-4 mr-2" /> Enable
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoriesSection() {
  const { toast } = useToast();
  const { data, isLoading } = useCategories();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingCat, setEditingCat] = React.useState<Category | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await deleteCategory(id);
    toast({ title: "Deleted" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Categories</CardTitle>
        <Button size="sm" onClick={() => { setEditingCat(null); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="h-12 bg-muted/20 rounded-lg" />)}</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data?.categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.icon}</div>
                  <div>
                    <p className="font-medium text-sm">{cat.name}</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5 capitalize">{cat.type}</Badge>
                  </div>
                </div>
                {!cat.isDefault && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingCat(cat); setIsDialogOpen(true); }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(cat.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CategoryDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} categoryToEdit={editingCat} />
    </Card>
  );
}

function CategoryDialog({ open, onOpenChange, categoryToEdit }: { open: boolean; onOpenChange: (v: boolean) => void; categoryToEdit: Category | null }) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState("📝");
  const [color, setColor] = React.useState("#10b981");
  const [type, setType] = React.useState<Category["type"]>("expense");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(categoryToEdit?.name ?? ""); setIcon(categoryToEdit?.icon ?? "📝");
      setColor(categoryToEdit?.color ?? "#10b981"); setType(categoryToEdit?.type ?? "expense");
    }
  }, [open, categoryToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    try {
      if (categoryToEdit) { await updateCategory(categoryToEdit.id, { name, icon, color, type }); toast({ title: "Updated" }); }
      else { await createCategory({ name, icon, color, type }); toast({ title: "Created" }); }
      onOpenChange(false);
    } finally { setIsSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{categoryToEdit ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3 space-y-2">
              <Label>Name</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="col-span-1 space-y-2">
              <Label>Icon</Label>
              <Input required value={icon} onChange={e => setIcon(e.target.value)} className="text-center text-lg" maxLength={2} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType(v as Category["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2 h-10 border rounded-md px-3">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                <span className="font-mono text-sm">{color}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="bg-green-500 hover:bg-green-600 text-white">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotificationsSection() {
  const { toast } = useToast();
  const { data, isLoading } = useNotificationSettings();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingNotif, setEditingNotif] = React.useState<NotificationSetting | null>(null);

  const handleToggleActive = async (notif: NotificationSetting) => {
    await updateNotification(notif.id, { isActive: !notif.isActive });
    toast({ title: notif.isActive ? "Paused" : "Enabled" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Reminders</CardTitle>
        <Button size="sm" onClick={() => { setEditingNotif(null); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="animate-pulse h-16 bg-muted/20 rounded-lg" /> : (
          <div className="space-y-3">
            {!data?.notifications.length ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No reminders yet.</p>
            ) : data?.notifications.map(notif => (
              <div key={notif.id} className={`flex items-start justify-between p-4 border rounded-xl ${notif.isActive ? "" : "opacity-60 bg-muted/20"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm">{notif.title}</p>
                    {!notif.isActive && <Badge variant="secondary" className="text-[10px]">Paused</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                  <div className="flex gap-2 mt-1.5">
                    <Badge variant="outline" className="text-xs capitalize">{notif.frequency}</Badge>
                    <Badge variant="outline" className="text-xs">🕐 {notif.time}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleToggleActive(notif)}>
                    {notif.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingNotif(notif); setIsDialogOpen(true); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteNotification(notif.id).then(() => toast({ title: "Deleted" }))}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <NotificationDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} notificationToEdit={editingNotif} />
    </Card>
  );
}

function NotificationDialog({ open, onOpenChange, notificationToEdit }: {
  open: boolean; onOpenChange: (v: boolean) => void; notificationToEdit: NotificationSetting | null;
}) {
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [frequency, setFrequency] = React.useState<NotificationSetting["frequency"]>("daily");
  const [time, setTime] = React.useState("09:00");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(notificationToEdit?.title ?? ""); setMessage(notificationToEdit?.message ?? "");
      setFrequency(notificationToEdit?.frequency ?? "daily"); setTime(notificationToEdit?.time ?? "09:00");
    }
  }, [open, notificationToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    try {
      if (notificationToEdit) { await updateNotification(notificationToEdit.id, { title, message, frequency, time }); toast({ title: "Updated" }); }
      else { await createNotification({ title, message, type: "daily_review", frequency, time, isActive: true }); toast({ title: "Created" }); }
      onOpenChange(false);
    } finally { setIsSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{notificationToEdit ? "Edit Reminder" : "New Reminder"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Daily Review" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Input required value={message} onChange={e => setMessage(e.target.value)} placeholder="Log today's expenses" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={v => setFrequency(v as NotificationSetting["frequency"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (Mon)</SelectItem>
                  <SelectItem value="monthly">Monthly (1st)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" required value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="bg-green-500 hover:bg-green-600 text-white">
              {isSaving ? "Saving…" : notificationToEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
