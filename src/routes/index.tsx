import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Wallet, PieChart, TrendingDown, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spend Wisely — Split your salary, track every spend" },
      {
        name: "description",
        content:
          "Plan your yearly budget, split it across categories, and track every spend in £ with Spend Wisely.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-4 w-4" />
          </span>
          Spend Wisely
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Log in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="px-6 md:px-12 py-16 md:py-24 text-center max-w-3xl mx-auto">
        <span className="inline-block rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium mb-6">
          Personal yearly budgeting
        </span>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
          Split your salary,
          <br />
          <span className="text-primary">spend wisely.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
          Set your yearly income, group your spending into categories, and watch your remaining
          budget at a glance — all in £.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Get started <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Log in</Link>
          </Button>
        </div>
      </section>

      <section className="px-6 md:px-12 pb-20 max-w-5xl mx-auto grid gap-4 md:grid-cols-3">
        <Feature icon={<Wallet className="h-5 w-5" />} title="Yearly income">
          One number to base your whole year on.
        </Feature>
        <Feature icon={<PieChart className="h-5 w-5" />} title="Custom categories">
          Rent, food, savings — whatever you spend on.
        </Feature>
        <Feature icon={<TrendingDown className="h-5 w-5" />} title="Live remaining">
          See what's left after every transaction.
        </Feature>
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
