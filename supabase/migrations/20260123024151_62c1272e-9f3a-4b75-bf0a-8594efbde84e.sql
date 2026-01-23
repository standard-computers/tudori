-- Add wage and bonus fields to employees table
ALTER TABLE public.employees
ADD COLUMN wage numeric DEFAULT NULL,
ADD COLUMN is_hourly boolean DEFAULT false,
ADD COLUMN bonus_eligible boolean DEFAULT false;