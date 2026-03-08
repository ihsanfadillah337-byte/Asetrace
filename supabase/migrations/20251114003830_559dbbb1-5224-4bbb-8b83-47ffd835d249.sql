-- Add BLE tag MAC address mapping to assets table
ALTER TABLE public.assets ADD COLUMN ble_tag_mac text;

-- Create index for faster lookups
CREATE INDEX idx_assets_ble_tag_mac ON public.assets(ble_tag_mac);

-- Create BLE tracking data table
CREATE TABLE public.ble_tracking_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  receiver_id text NOT NULL,
  tag_mac text NOT NULL,
  rssi integer NOT NULL,
  receiver_location jsonb NOT NULL,
  timestamp timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_ble_tracking_asset_id ON public.ble_tracking_data(asset_id);
CREATE INDEX idx_ble_tracking_timestamp ON public.ble_tracking_data(timestamp DESC);
CREATE INDEX idx_ble_tracking_tag_mac ON public.ble_tracking_data(tag_mac);

-- Enable Row Level Security
ALTER TABLE public.ble_tracking_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ble_tracking_data
CREATE POLICY "Authenticated users can view BLE tracking data"
  ON public.ble_tracking_data
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert BLE tracking data"
  ON public.ble_tracking_data
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime for ble_tracking_data
ALTER PUBLICATION supabase_realtime ADD TABLE public.ble_tracking_data;