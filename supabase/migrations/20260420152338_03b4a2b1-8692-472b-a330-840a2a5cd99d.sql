-- Bank items (one per linked institution)
CREATE TABLE public.bank_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plaid_item_id TEXT NOT NULL UNIQUE,
  plaid_access_token TEXT NOT NULL,
  institution_name TEXT,
  institution_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  cursor TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bank items" ON public.bank_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bank items" ON public.bank_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bank items" ON public.bank_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own bank items" ON public.bank_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_bank_items_user ON public.bank_items(user_id);

CREATE TRIGGER update_bank_items_updated_at
  BEFORE UPDATE ON public.bank_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend transactions with merchant + pending category + external dedupe id
ALTER TABLE public.transactions
  ADD COLUMN merchant_name TEXT,
  ADD COLUMN pending_category BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN external_id TEXT,
  ADD COLUMN bank_item_id UUID REFERENCES public.bank_items(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_transactions_external_id_user
  ON public.transactions(user_id, external_id)
  WHERE external_id IS NOT NULL;