-- Fix notifications_type_check constraint to include all required notification types
-- This allows edge functions to insert 'asset_recovery', 'signal_lost', etc.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
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
  'asset_movement'::text,
  'asset_recovery'::text,
  'signal_lost'::text,
  'visibility_warning'::text,
  'system_alert'::text
]));