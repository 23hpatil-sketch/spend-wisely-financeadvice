import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { AppShell } from "@/components/AppShell";
import { LogSpendDialog } from "@/components/LogSpendDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { gbp } from "@/lib/format";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { categories, transactions, refresh } = useProfileData();

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

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Tap a category to log a spend.
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
            return (
              <Card key={c.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="mt-1 text-2xl font-semibold">{gbp(spent)}</p>
                      <p className="text-xs text-muted-foreground">spent this year</p>
                    </div>
                    <LogSpendDialog
                      trigger={
                        <Button size="icon" variant="secondary" className="rounded-full">
                          <Plus className="h-4 w-4" />
                        </Button>
                      }
                      categoryId={c.id}
                      categoryName={c.name}
                      onSaved={refresh}
                    />
                  </div>
                  <LogSpendDialog
                    trigger={
                      <Button className="mt-4 w-full">Log spend</Button>
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
