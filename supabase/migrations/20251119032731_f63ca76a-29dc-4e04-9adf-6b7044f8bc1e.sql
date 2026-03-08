-- Create gateway status tracking table
CREATE TABLE IF NOT EXISTS public.ble_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_id text UNIQUE NOT NULL,
  room_id uuid REFERENCES public.rooms(id),
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'stale', 'offline')),
  scan_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create RSSI smoothing buffer table
CREATE TABLE IF NOT EXISTS public.ble_rssi_buffer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_mac text NOT NULL,
  receiver_id text NOT NULL,
  rssi integer NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create asset location tracking table
CREATE TABLE IF NOT EXISTS public.asset_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  tag_mac text NOT NULL,
  room_id uuid REFERENCES public.rooms(id),
  receiver_id text NOT NULL,
  rssi integer NOT NULL,
  confidence text DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(asset_id)
);

-- Enable RLS
ALTER TABLE public.ble_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ble_rssi_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view gateways"
  ON public.ble_gateways FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage gateways"
  ON public.ble_gateways FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view rssi buffer"
  ON public.ble_rssi_buffer FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage rssi buffer"
  ON public.ble_rssi_buffer FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view asset locations"
  ON public.asset_locations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage asset locations"
  ON public.asset_locations FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_ble_gateways_receiver ON ble_gateways(receiver_id);
CREATE INDEX idx_ble_gateways_status ON ble_gateways(status, last_seen);
CREATE INDEX idx_rssi_buffer_tag_receiver ON ble_rssi_buffer(tag_mac, receiver_id, timestamp DESC);
CREATE INDEX idx_asset_locations_asset ON asset_locations(asset_id);
CREATE INDEX idx_asset_locations_room ON asset_locations(room_id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.ble_gateways;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_locations;

-- Create function to clean old RSSI buffer entries (keep last 10 per tag/gateway)
CREATE OR REPLACE FUNCTION clean_rssi_buffer()
RETURNS trigger AS $$
BEGIN
  DELETE FROM ble_rssi_buffer
  WHERE id IN (
    SELECT id FROM ble_rssi_buffer
    WHERE tag_mac = NEW.tag_mac AND receiver_id = NEW.receiver_id
    ORDER BY timestamp DESC
    OFFSET 10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clean_rssi_buffer
  AFTER INSERT ON ble_rssi_buffer
  FOR EACH ROW
  EXECUTE FUNCTION clean_rssi_buffer();