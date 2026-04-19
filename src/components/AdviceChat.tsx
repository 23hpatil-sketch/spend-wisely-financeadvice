import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Bot, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/money-advice`;

export function AdviceChat({ context }: { context: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
      scrollToBottom();
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg], context }),
      });

      if (resp.status === 429) {
        toast.error("Too many requests — try again shortly.");
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("AI credits exhausted. Add funds in Lovable workspace settings.");
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        toast.error("Couldn't reach the assistant.");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buffer += decoder.decode(r.value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          Want advice for money spendings?
        </CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className="mb-3 max-h-72 overflow-y-auto space-y-3 rounded-lg border bg-background/50 p-3"
          >
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2 text-sm", m.role === "user" && "justify-end")}>
                {m.role === "assistant" && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.content || (loading && i === messages.length - 1 ? "…" : "")}
                </div>
                {m.role === "user" && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <UserIcon className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <form onSubmit={send} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask: How can I save more on groceries?"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} size="icon" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {messages.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "How am I doing this month?",
              "Where can I cut spending?",
              "Suggest a savings plan",
            ].map((q) => (
              <Button
                key={q}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => { setInput(q); }}
                disabled={loading}
              >
                {q}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
