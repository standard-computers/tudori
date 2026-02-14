-- Add task_id reference to goods_receipts for task-based receiving
ALTER TABLE public.goods_receipts ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;