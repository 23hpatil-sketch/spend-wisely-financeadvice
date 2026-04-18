import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gbp } from "@/lib/format";
import { Wallet, TrendingDown, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { profile, transactions, loading } = useProfileData();

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!loading && profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [profile, loading, navigate]);

  const totalSpent = useMemo(
    () => transactions.reduce((s, t) => s + Number(t.amount), 0),
    [transactions]
  );
  const salary = Number(profile?.yearly_salary ?? 0);
  const remaining = salary - totalSpent;

  return (
    <AppShell>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Yearly Salary" value={gbp(salary)} icon={<Wallet className="h-5 w-5" />} tone="primary" />
        <StatCard title="Total Spent" value={gbp(totalSpent)} icon={<TrendingDown className="h-5 w-5" />} tone="destructive" />
        <StatCard title="Remaining" value={gbp(remaining)} icon={<PiggyBank className="h-5 w-5" />} tone={remaining >= 0 ? "success" : "destructive"} />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent transactions</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link to="/transactions">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.slice(0, 5).map((t) => (
                <li key={t.id} className="py-2 flex justify-between text-sm">
                  <span>{t.description || "Transaction"}</span>
                  <span className="font-medium">{gbp(Number(t.amount))}</span>
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
