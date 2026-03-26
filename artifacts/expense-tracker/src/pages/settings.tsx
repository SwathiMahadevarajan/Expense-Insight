import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useListCategories, useListNotifications } from "@workspace/api-client-react";
import { useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/use-categories";
import { useCreateNotification, useUpdateNotification, useDeleteNotification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Edit2, Plus, Bell, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Category, NotificationSetting, CreateCategoryInputType, CreateNotificationInputType, CreateNotificationInputFrequency } from "@workspace/api-client-react";

export default function Settings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your app preferences.</p>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="categories"><Tags className="w-4 h-4 mr-2" /> Categories</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" /> Reminders</TabsTrigger>
        </TabsList>
        
        <TabsContent value="categories" className="mt-6">
          <CategoriesSettings />
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-6">
          <NotificationsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriesSettings() {
  const { toast } = useToast();
  const { data, isLoading } = useListCategories();
  const deleteCat = useDeleteCategory();
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingCat, setEditingCat] = React.useState<Category | null>(null);

  const handleDelete = (id: string) => {
    if (confirm("Delete this category? Transactions using it will lose their category association.")) {
      deleteCat.mutate({ id }, {
        onSuccess: () => toast({ title: "Deleted category" })
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Manage how you group transactions.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditingCat(null); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Category
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted/20 rounded-lg"></div>
            <div className="h-12 bg-muted/20 rounded-lg"></div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                    {cat.icon}
                  </div>
                  <div>
                    <p className="font-medium">{cat.name}</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5 capitalize">{cat.type}</Badge>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingCat(cat); setIsDialogOpen(true); }}>
                    <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(cat.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CategoryDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} categoryToEdit={editingCat} />
    </Card>
  );
}

function CategoryDialog({ open, onOpenChange, categoryToEdit }: { open: boolean, onOpenChange: (open: boolean) => void, categoryToEdit: Category | null }) {
  const { toast } = useToast();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();

  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState("📝");
  const [color, setColor] = React.useState("#10b981");
  const [type, setType] = React.useState<CreateCategoryInputType>("expense");

  React.useEffect(() => {
    if (open) {
      if (categoryToEdit) {
        setName(categoryToEdit.name);
        setIcon(categoryToEdit.icon);
        setColor(categoryToEdit.color);
        setType(categoryToEdit.type as CreateCategoryInputType);
      } else {
        setName("");
        setIcon("📝");
        setColor("#10b981");
        setType("expense");
      }
    }
  }, [open, categoryToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, icon, color, type };
    if (categoryToEdit) {
      updateCat.mutate({ id: categoryToEdit.id, data: payload }, {
        onSuccess: () => { toast({ title: "Updated" }); onOpenChange(false); }
      });
    } else {
      createCat.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Created" }); onOpenChange(false); }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoryToEdit ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 space-y-2">
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-span-1 space-y-2">
              <Label>Emoji Icon</Label>
              <Input required value={icon} onChange={(e) => setIcon(e.target.value)} className="text-center text-lg" maxLength={2} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CreateCategoryInputType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex gap-2 items-center h-10 border rounded-md px-3">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer" />
                <span className="font-mono text-sm">{color}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createCat.isPending || updateCat.isPending}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotificationsSettings() {
  const { toast } = useToast();
  const { data, isLoading } = useListNotifications();
  const deleteNotif = useDeleteNotification();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const testNotification = (title: string, message: string) => {
    if (!("Notification" in window)) {
      toast({ title: "Browser does not support notifications", variant: "destructive" });
      return;
    }
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body: message, icon: '/favicon.svg' });
      } else {
        toast({ title: "Notification permission denied", variant: "destructive" });
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Setup alerts for bills and reviews.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Reminder
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted/20 rounded-lg"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.notifications.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No reminders configured.</p>
            ) : (
              data?.notifications.map((notif) => (
                <div key={notif.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card">
                  <div className="mb-3 sm:mb-0">
                    <h4 className="font-bold flex items-center gap-2">
                      {notif.title}
                      {!notif.isActive && <Badge variant="secondary">Disabled</Badge>}
                    </h4>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="capitalize">{notif.frequency}</Badge>
                      <Badge variant="outline">{notif.time}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => testNotification(notif.title, notif.message)}>
                      Test
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteNotif.mutate({ id: notif.id })}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
      <NotificationDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </Card>
  );
}

function NotificationDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createNotif = useCreateNotification();

  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [type, setType] = React.useState<CreateNotificationInputType>("daily_review");
  const [frequency, setFrequency] = React.useState<CreateNotificationInputFrequency>("daily");
  const [time, setTime] = React.useState("09:00");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createNotif.mutate({
      data: { title, message, type, frequency, time, isActive: true }
    }, {
      onSuccess: () => {
        toast({ title: "Reminder created" });
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Reminder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Daily Review" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Input required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Time to log today's expenses!" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as CreateNotificationInputFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createNotif.isPending}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
