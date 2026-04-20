import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Sun, Moon, Monitor } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { profile, categories, refresh } = useProfileData();
  const { theme, setTheme } = useTheme();
  const [salary, setSalary] = useState("");
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) setSalary(String(profile.yearly_salary));
  }, [profile]);

  const saveSalary = async () => {
    if (!user) return;
    const v = parseFloat(salary);
    if (Number.isNaN(v) || v < 0) return toast.error("Invalid salary.");
    const { error } = await supabase.from("profiles").update({ yearly_salary: v }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Salary updated");
    await refresh();
  };

  const addCat = async () => {
    if (!user) return;
    const v = newCat.trim();
    if (!v) return;
    const { error } = await supabase.from("categories").insert({ user_id: user.id, name: v });
    if (error) return toast.error(error.message);
    setNewCat("");
    await refresh();
  };

  const removeCat = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refresh();
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose Light, Dark, or follow your system.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Theme</span>
            <div className="inline-flex rounded-lg border bg-muted/40 p-1">
              {([
                { v: "light", label: "Light", Icon: Sun },
                { v: "dark", label: "Dark", Icon: Moon },
                { v: "system", label: "System", Icon: Monitor },
              ] as const).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  onClick={() => setTheme(v)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    theme === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yearly salary</CardTitle>
            <CardDescription>Used to calculate your remaining budget.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="sal">Salary (£ / year)</Label>
            <div className="flex gap-2">
              <Input id="sal" type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} />
              <Button onClick={saveSalary}>Save</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Add or remove spending categories.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
                  {c.name}
                  <button onClick={() => removeCat(c.id)} aria-label={`Remove ${c.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add category"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCat())}
              />
              <Button onClick={addCat} variant="secondary"><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
