-- Create a table to store user transaction code access
CREATE TABLE public.user_transaction_access (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    transaction_code TEXT NOT NULL,
    has_access BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, company_id, transaction_code)
);

-- Enable RLS
ALTER TABLE public.user_transaction_access ENABLE ROW LEVEL SECURITY;

-- Create policies for user_transaction_access
CREATE POLICY "Users can view their own transaction access"
ON public.user_transaction_access
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Company admins can view all transaction access"
ON public.user_transaction_access
FOR SELECT
USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Company admins can insert transaction access"
ON public.user_transaction_access
FOR INSERT
WITH CHECK (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Company admins can update transaction access"
ON public.user_transaction_access
FOR UPDATE
USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "Company admins can delete transaction access"
ON public.user_transaction_access
FOR DELETE
USING (public.is_company_admin(auth.uid(), company_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_transaction_access_updated_at
BEFORE UPDATE ON public.user_transaction_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();