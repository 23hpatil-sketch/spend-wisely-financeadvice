import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sparkles, Send, Bot, User as UserIcon, History, Plus, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Msg = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/money-advice`;

export function AdviceChat({ context }: { context: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setConversations((data ?? []) as Conversation[]);
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
  };

  const openConversation = async (id: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", id)
      .order("created_at");
    if (error) return toast.error("Couldn't load conversation");
    setMessages((data ?? []) as Msg[]);
    setConversationId(id);
    setHistoryOpen(false);
    scrollToBottom();
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("chat_conversations").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete");
    if (conversationId === id) startNewChat();
    await loadConversations();
  };

  const ensureConversation = async (firstUserText: string): Promise<string | null> => {
    if (!user) return null;
    if (conversationId) return conversationId;
    const title = firstUserText.slice(0, 60) + (firstUserText.length > 60 ? "…" : "");
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Couldn't save chat");
      return null;
    }
    setConversationId(data.id);
    return data.id;
  };

  const saveMessage = async (convId: string, msg: Msg) => {
    if (!user) return;
    await supabase.from("chat_messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: msg.role,
      content: msg.content,
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

    const convId = await ensureConversation(text);
    if (convId) await saveMessage(convId, userMsg);

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

      if (convId && assistantSoFar) {
        await saveMessage(convId, { role: "assistant", content: assistantSoFar });
        await loadConversations();
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            Want advice for money spendings?
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={startNewChat} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New chat
            </Button>
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={loadConversations}>
                  <History className="h-3.5 w-3.5" /> History
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[380px] p-0 flex flex-col">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Chat history
                  </SheetTitle>
                </SheetHeader>
                <div className="p-3 border-b">
                  <Button
                    onClick={() => { startNewChat(); setHistoryOpen(false); }}
                    className="w-full justify-start gap-2"
                    variant="secondary"
                  >
                    <Plus className="h-4 w-4" /> New chat
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8 px-4">
                      No saved chats yet. Start one and click "New chat" to save it.
                    </p>
                  ) : (
                    conversations.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => openConversation(c.id)}
                        className={cn(
                          "group w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors flex items-start gap-2",
                          conversationId === c.id
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.updated_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteConversation(c.id, e)}
                          aria-label="Delete chat"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </button>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
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
