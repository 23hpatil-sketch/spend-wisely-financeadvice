import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfileData } from "@/lib/useProfile";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gbp } from "@/lib/format";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

type Range = "daily" | "weekly" | "monthly" | "yearly";

declare global {
  interface Window {
    median_admob_rewarded_didReward?: () => void;
  }
}

export const Route = createFileRoute("/graph")({
  component: GraphPage,
});

function GraphPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { transactions } = useProfileData();
  const [range, setRange] = useState<Range>("monthly");
  const [hasWatchedAd, setHasWatchedAd] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    window.median_admob_rewarded_didReward = () => {
      setHasWatchedAd(true);
    };
    return () => {
      delete (window as any).median_admob_rewarded_didReward;
    };
  }, []);

  const handleShowGraph = () => {
    (window as any).location.href = "median://admob/rewarded/show?id=YOUR_AD_UNIT_ID";
  };

  const data = useMemo(() => buildData(transactions, range), [transactions, range]);
  const total = data.reduce((s, d) => s + d.amount, 0);
  const avg = data.length ? total / data.length : 0;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Spending overview</p>
          <p className="text-2xl font-semibold">{gbp(total)}</p>
          <p className="text-xs text-muted-foreground">
            avg {gbp(avg)} / {labelFor(range)}
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base capitalize">{range} spending</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No transactions yet — log a spend to see your chart.
            </p>
          ) : !hasWatchedAd ? (
            <div className="h-[360px] w-full flex flex-col items-center justify-center gap-4">
              <p className="text-sm text-muted-foreground">Watch an ad to unlock your graph</p>
              <button
                onClick={handleShowGraph}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
              >
                Watch Ad
              </button>
            </div>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tickFormatter={(v) => `£${v}`}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                    formatter={(value) => [gbp(Number(value)), "Spent"]}
                  />
                  <ReferenceLine y={avg} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#spendFill)"
                    dot={{ r: 3, fill: "var(--primary)", stroke: "var(--primary)" }}
                    activeDot={{ r: 5, fill: "var(--primary)" }}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function labelFor(r: Range) {
  return r === "daily" ? "day" : r === "weekly" ? "week" : r === "monthly" ? "month" : "year";
}

type Tx = { amount: number; occurred_at: string };

function buildData(txs: Tx[], range: Range): { label: string; amount: number }[] {
  const now = new Date();
  const buckets = new Map<string, { label: string; amount: number; sortKey: number }>();

  if (range === "daily") {
    // Last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, {
        label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        amount: 0,
        sortKey: d.getTime(),
      });
    }
    for (const t of txs) {
      const d = new Date(t.occurred_at);
      const key = d.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) b.amount += Number(t.amount);
    }
  } else if (range === "weekly") {
    // Last 12 weeks (week starts Monday)
    const startOfWeek = (d: Date) => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const day = (x.getDay() + 6) % 7; // Monday=0
      x.setDate(x.getDate() - day);
      return x;
    };
    const thisWeek = startOfWeek(now);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisWeek);
      d.setDate(d.getDate() - i * 7);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, {
        label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        amount: 0,
        sortKey: d.getTime(),
      });
    }
    for (const t of txs) {
      const k = startOfWeek(new Date(t.occurred_at)).toISOString().slice(0, 10);
      const b = buckets.get(k);
      if (b) b.amount += Number(t.amount);
    }
  } else if (range === "monthly") {
    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, {
        label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        amount: 0,
        sortKey: d.getTime(),
      });
    }
    for (const t of txs) {
      const d = new Date(t.occurred_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.get(k);
      if (b) b.amount += Number(t.amount);
    }
  } else {
    // Yearly — last 5 years
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      buckets.set(String(y), { label: String(y), amount: 0, sortKey: y });
    }
    for (const t of txs) {
      const y = String(new Date(t.occurred_at).getFullYear());
      const b = buckets.get(y);
      if (b) b.amount += Number(t.amount);
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ label, amount }) => ({ label, amount: Math.round(amount * 100) / 100 }));
}
