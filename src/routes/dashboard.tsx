import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { AppShell } from "@/components/AppShell";
import { LogSpendDialog } from "@/components/LogSpendDialog";
import { AdviceChat } from "@/components/AdviceChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { gbp } from "@/lib/format";
import { Wallet, TrendingDown, PiggyBank, Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { profile, categories, transactions, loading, refresh } = useProfileData();

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!loading && profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [profile, loading, navigate]);

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }, []);

  const monthlyTx = useMemo(
    () => transactions.filter((t) => new Date(t.occurred_at).getTime() >= monthStart),
    [transactions, monthStart]
  );

  const totalSpent = useMemo(
    () => monthlyTx.reduce((s, t) => s + Number(t.amount), 0),
    [monthlyTx]
  );
  const yearlySalary = Number(profile?.yearly_salary ?? 0);
  const monthlySalary = yearlySalary / 12;
  const remaining = monthlySalary - totalSpent;
  const pct = monthlySalary > 0 ? Math.min(100, (totalSpent / monthlySalary) * 100) : 0;

  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthlyTx) {
      const k = t.category_id ?? "__none__";
      map.set(k, (map.get(k) ?? 0) + Number(t.amount));
    }
    return map;
  }, [monthlyTx]);

  return (
    <AppShell>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Yearly Income" value={gbp(salary)} icon={<Wallet className="h-5 w-5" />} tone="primary" />
        <StatCard title="Total Spent" value={gbp(totalSpent)} icon={<TrendingDown className="h-5 w-5" />} tone="destructive" />
        <StatCard
          title="Remaining"
          value={gbp(remaining)}
          icon={<PiggyBank className="h-5 w-5" />}
          tone={remaining >= 0 ? "success" : "destructive"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Yearly progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={pct} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{gbp(totalSpent)} spent</span>
            <span>{pct.toFixed(0)}% of {gbp(salary)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <AdviceChat
          context={`Yearly income: ${gbp(salary)}. Spent so far: ${gbp(totalSpent)} (${pct.toFixed(0)}%). Remaining: ${gbp(remaining)}. Categories: ${categories.map((c) => `${c.name} (${gbp(spentByCat.get(c.id) ?? 0)})`).join(", ") || "none"}. Recent transactions: ${transactions.slice(0, 8).map((t) => `${t.description ?? "tx"} ${gbp(Number(t.amount))}`).join("; ") || "none"}.`}
        />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/categories">
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="py-6 text-sm text-muted-foreground">
            No categories yet. Add some in <Link to="/settings" className="text-primary underline">Settings</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const spent = spentByCat.get(c.id) ?? 0;
            const budget = Number(c.monthly_budget ?? 0);
            const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
            const over = budget > 0 && spent > budget;
            return (
              <Card key={c.id} className="group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className={`mt-1 text-2xl font-semibold ${over ? "text-destructive" : ""}`}>
                        {gbp(spent)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        spent of {gbp(budget)}
                      </p>
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
                  {budget > 0 && (
                    <Progress value={pct} className="mt-3 h-2" />
                  )}
                  <LogSpendDialog
                    trigger={
                      <Button variant="outline" size="sm" className="mt-4 w-full">
                        Log spend
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

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone: "primary" | "destructive" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : "bg-success/10 text-success";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className={`rounded-full p-2 ${toneClass}`}>{icon}</div>
        </div>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
