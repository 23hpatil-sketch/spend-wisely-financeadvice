import { createFileRoute } from "@tanstack/react-router";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getPlaid() {
  const cfg = new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
        "PLAID-SECRET": process.env.PLAID_SECRET!,
      },
    },
  });
  return new PlaidApi(cfg);
}

async function sendPushToUser(userId: string, payload: Record<string, unknown>) {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) return;
  webpush.setVapidDetails(subject, pub, priv);

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  if (!subs?.length) return;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("push send error", err?.statusCode, err?.body);
        }
      }
    }),
  );
}

async function syncTransactions(itemId: string) {
  const { data: item } = await supabaseAdmin
    .from("bank_items")
    .select("*")
    .eq("plaid_item_id", itemId)
    .maybeSingle();
  if (!item) return;

  const plaid = getPlaid();
  let cursor: string | null = item.cursor ?? null;
  let added: any[] = [];
  let hasMore = true;

  while (hasMore) {
    const res = await plaid.transactionsSync({
      access_token: item.plaid_access_token,
      cursor: cursor ?? undefined,
    });
    added = added.concat(res.data.added);
    cursor = res.data.next_cursor;
    hasMore = res.data.has_more;
  }

  if (added.length) {
    const rows = added.map((t) => ({
      user_id: item.user_id,
      bank_item_id: item.id,
      external_id: t.transaction_id,
      amount: t.amount,
      description: t.name ?? null,
      merchant_name: t.merchant_name ?? t.name ?? null,
      occurred_at: t.date ? new Date(t.date).toISOString() : new Date().toISOString(),
      pending_category: true,
    }));
    const { data: inserted } = await supabaseAdmin
      .from("transactions")
      .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true })
      .select("id, amount, merchant_name, description");

    for (const tx of inserted ?? []) {
      await sendPushToUser(item.user_id, {
        type: "new_transaction",
        transactionId: tx.id,
        amount: Number(tx.amount),
        merchantName: tx.merchant_name ?? tx.description ?? "Unknown",
        title: "New Transaction",
        body: `£${Number(tx.amount).toFixed(2)} at ${tx.merchant_name ?? tx.description ?? "Unknown"}. Select category to deduct from:`,
      });
    }
  }

  await supabaseAdmin
    .from("bank_items")
    .update({ cursor, last_synced_at: new Date().toISOString() })
    .eq("id", item.id);
}

export const Route = createFileRoute("/api/public/plaid-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const code = body?.webhook_code;
          const itemId = body?.item_id;
          if (
            itemId &&
            (code === "INITIAL_UPDATE" ||
              code === "DEFAULT_UPDATE" ||
              code === "HISTORICAL_UPDATE" ||
              code === "SYNC_UPDATES_AVAILABLE" ||
              code === "TRANSACTIONS_REMOVED")
          ) {
            await syncTransactions(itemId);
          }
          return Response.json({ ok: true });
        } catch (err) {
          console.error("plaid-webhook error", err);
          return Response.json({ ok: false, error: String(err) }, { status: 500 });
        }
      },
    },
  },
});