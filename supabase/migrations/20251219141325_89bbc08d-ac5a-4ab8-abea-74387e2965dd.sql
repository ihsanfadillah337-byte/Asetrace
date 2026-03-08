-- Add new notification types for security alerts
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY[
    'borrow_approved'::text, 
    'borrow_rejected'::text, 
    'borrow_returned'::text, 
    'maintenance_due'::text, 
    'maintenance_completed'::text, 
    'asset_status_changed'::text, 
    'usage_alert'::text,
    'security_alert'::text,
    'ghost_asset'::text,
    'asset_movement'::text
  ]));

-- Add 'untracked' status to asset_status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'untracked' AND enumtypid = 'asset_status'::regtype) THEN
    ALTER TYPE asset_status ADD VALUE 'untracked';
  END IF;
END $$;