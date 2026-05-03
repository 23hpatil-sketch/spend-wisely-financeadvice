import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const client = getPlaidClient();
    const res = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Spend Wisely",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us, CountryCode.Gb],
      language: "en",
    });
    return { linkToken: res.data.link_token };
  });

export const exchangePlaidPublicToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        publicToken: z.string().min(1).max(500),
        institutionId: z.string().max(200).optional().nullable(),
        institutionName: z.string().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const client = getPlaidClient();

    const exchange = await client.itemPublicTokenExchange({
      public_token: data.publicToken,
    });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    const { error } = await supabase.from("bank_items").insert({
      user_id: userId,
      plaid_item_id: itemId,
      plaid_access_token: accessToken,
      institution_id: data.institutionId ?? null,
      institution_name: data.institutionName ?? null,
      status: "active",
    });
    if (error) throw new Error(error.message);

    return { ok: true, institutionName: data.institutionName ?? null };
  });