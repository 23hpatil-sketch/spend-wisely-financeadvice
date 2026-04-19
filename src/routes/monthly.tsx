import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { gbp } from "@/lib/format";
import { Wallet, TrendingDown, PiggyBank, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/monthly")({
  component: MonthlyPage,
});

function MonthlyPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { profile, categories, transactions } = useProfileData();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const { start, end, label } = useMemo(() => {
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const label = s.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return { start: s, end: e, label };
  }, [cursor]);

  const monthlyIncome = (Number(profile?.yearly_salary ?? 0)) / 12;

  const monthTx = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.occurred_at);
      return d >= start && d < end;
    });
  }, [transactions, start, end]);

  const totalSpent = useMemo(
    () => monthTx.reduce((s, t) => s + Number(t.amount), 0),
    [monthTx]
  );
  const remaining = monthlyIncome - totalSpent;
  const pct = monthlyIncome > 0 ? Math.min(100, (totalSpent / monthlyIncome) * 100) : 0;

  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTx) {
      const k = t.category_id ?? "__none__";
      map.set(k, (map.get(k) ?? 0) + Number(t.amount));
    }
    return map;
  }, [monthTx]);

  const shift = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const isCurrentMonth = (() => {
    const now = new Date();
    return cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();
  })();

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{label}</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => shift(1)}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Monthly Income" value={gbp(monthlyIncome)} icon={<Wallet className="h-5 w-5" />} tone="primary" />
        <StatCard title="Spent this Month" value={gbp(totalSpent)} icon={<TrendingDown className="h-5 w-5" />} tone="destructive" />
        <StatCard
          title="Remaining"
          value={gbp(remaining)}
          icon={<PiggyBank className="h-5 w-5" />}
          tone={remaining >= 0 ? "success" : "destructive"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={pct} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{gbp(totalSpent)} spent</span>
            <span>{pct.toFixed(0)}% of {gbp(monthlyIncome)}</span>
          </div>
        </CardContent>
      </Card>

      <h2 className="mt-6 mb-3 text-lg font-semibold">By category</h2>
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No categories yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const spent = spentByCat.get(c.id) ?? 0;
            return (
              <Card key={c.id}>
                <CardContent className="p-5">
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 text-2xl font-semibold">{gbp(spent)}</p>
                  <p className="text-xs text-muted-foreground">spent in {label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transactions in {label}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions in this month.</p>
          ) : (
            <ul className="divide-y divide-border">
              {monthTx.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.description || "Transaction"}</p>
                    <p className="text-xs text-muted-foreground">
                      {categories.find((c) => c.id === t.category_id)?.name ?? "Uncategorised"} ·{" "}
                      {new Date(t.occurred_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <span className="font-semibold">{gbp(Number(t.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
