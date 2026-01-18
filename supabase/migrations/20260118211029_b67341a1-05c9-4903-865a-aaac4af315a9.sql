-- Add DELETE policy for ledger_transactions (currently missing)
CREATE POLICY "Users can delete transactions in their company ledgers"
ON public.ledger_transactions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.ledgers
    WHERE ledgers.id = ledger_transactions.ledger_id
    AND ledgers.company_id = public.get_user_company_id(auth.uid())
  )
);