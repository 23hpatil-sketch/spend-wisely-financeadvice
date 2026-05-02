import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { LogSpendDialog } from "@/components/LogSpendDialog";
import { DeleteCategoryDialog } from "@/components/DeleteCategoryDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { gbp } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { categories, transactions, refresh } = useProfileData();
  const [drafts, setDrafts] = useState<Record<string, { name: string; budget: string }>>({});

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, { name: string; budget: string }> = {};
      for (const c of categories) {
        next[c.id] = prev[c.id] ?? { name: c.name, budget: String(c.monthly_budget ?? 0) };
      }
      return next;
    });
  }, [categories]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      const k = t.category_id ?? "__none__";
      map.set(k, (map.get(k) ?? 0) + Number(t.amount));
    }
    return map;
  }, [transactions]);

  const saveName = async (id: string, current: string) => {
    const v = (drafts[id]?.name ?? "").trim();
    if (!v || v === current) return;
    const { error } = await supabase.from("categories").update({ name: v }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Name updated");
    await refresh();
  };

  const saveBudget = async (id: string, current: number) => {
    const v = parseFloat(drafts[id]?.budget ?? "");
    if (Number.isNaN(v) || v < 0) return toast.error("Invalid budget.");
    if (v === current) return;
    const { error } = await supabase.from("categories").update({ monthly_budget: v }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Budget updated");
    await refresh();
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Edit a category's name or budget, or log a spend.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/settings">Manage</Link>
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No categories yet. Add some in{" "}
            <Link to="/settings" className="text-primary underline">Settings</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const spent = spentByCat.get(c.id) ?? 0;
            const budget = Number(c.monthly_budget ?? 0);
            const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
            const draft = drafts[c.id] ?? { name: c.name, budget: String(budget) };
            return (
              <Card key={c.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      className="h-9 font-medium"
                      value={draft.name}
                      onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...draft, name: e.target.value } })}
                      onBlur={() => saveName(c.id, c.name)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    />
                    <DeleteCategoryDialog
                      categoryId={c.id}
                      categoryName={c.name}
                      onDeleted={refresh}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>

                  <div>
                    <p className="text-2xl font-semibold">{gbp(spent)}</p>
                    <p className="text-xs text-muted-foreground">
                      of {gbp(budget)} monthly budget
                    </p>
                    <Progress value={pct} className="mt-2 h-2" />
                  </div>

                  <div>
                    <Label htmlFor={`budget-${c.id}`} className="text-xs text-muted-foreground">Monthly budget (£)</Label>
                    <Input
                      id={`budget-${c.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 h-9"
                      value={draft.budget}
                      onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...draft, budget: e.target.value } })}
                      onBlur={() => saveBudget(c.id, budget)}
                    />
                  </div>

                  <LogSpendDialog
                    trigger={
                      <Button className="w-full">
                        <Plus className="mr-1 h-4 w-4" /> Log spend
                      </Button>
                    }
                    categoryId={c.id}
                    categoryName={c.name}
                    onSaved={refresh}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
