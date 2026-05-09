-- Add new snapshot columns to track Ziroo's commission math historically
ALTER TABLE public.monthly_summaries
ADD COLUMN ziroo_online_orders_count INTEGER DEFAULT 0,
ADD COLUMN ziroo_subscription_snapshot NUMERIC(10,2) DEFAULT 0,
ADD COLUMN ziroo_online_fee_snapshot NUMERIC(10,2) DEFAULT 0;
