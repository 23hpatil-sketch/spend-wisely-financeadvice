import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function getAuthedSupabase(accessToken: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized");
  return { supabase, userId: data.claims.sub as string };
}

function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error("Plaid credentials are not configured.");
  }
  const config = new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(config);
}

export const createPlaidLinkToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(10).max(4000) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { userId } = await getAuthedSupabase(data.accessToken);
      const client = getPlaidClient();
      const res = await client.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "Spend Wisely",
        products: [Products.Transactions],
        country_codes: [CountryCode.Us, CountryCode.Gb],
        language: "en",
      });
      return { linkToken: res.data.link_token, error: null as string | null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create link token";
      console.error("createPlaidLinkToken error:", msg);
      return { linkToken: null as string | null, error: msg };
    }
  });

export const exchangePlaidPublicToken = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        accessToken: z.string().min(10).max(4000),
        publicToken: z.string().min(1).max(500),
        institutionId: z.string().max(200).optional().nullable(),
        institutionName: z.string().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const { supabase, userId } = await getAuthedSupabase(data.accessToken);
      const client = getPlaidClient();
      const exchange = await client.itemPublicTokenExchange({ public_token: data.publicToken });
      const { error } = await supabase.from("bank_items").insert({
        user_id: userId,
        plaid_item_id: exchange.data.item_id,
        plaid_access_token: exchange.data.access_token,
        institution_id: data.institutionId ?? null,
        institution_name: data.institutionName ?? null,
        status: "active",
      });
      if (error) throw new Error(error.message);
      return { ok: true, error: null as string | null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to exchange token";
      console.error("exchangePlaidPublicToken error:", msg);
      return { ok: false, error: msg };
    }
  });