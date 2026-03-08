-- Create categories table for dynamic asset categories
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view categories
CREATE POLICY "Authenticated users can view categories"
ON public.categories
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
ON public.categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default categories
INSERT INTO public.categories (name, description) VALUES
  ('laptop', 'Portable computers'),
  ('server', 'Server equipment'),
  ('furniture', 'Office furniture'),
  ('vehicle', 'Transportation vehicles'),
  ('other', 'Miscellaneous items');

-- Create asset_movement_history table for Digital Twin tracking
CREATE TABLE public.asset_movement_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  from_room_id UUID REFERENCES public.rooms(id),
  to_room_id UUID NOT NULL REFERENCES public.rooms(id),
  from_room_name TEXT,
  to_room_name TEXT,
  detected_by TEXT, -- gateway receiver_id
  rssi INTEGER,
  moved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asset_movement_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view movement history
CREATE POLICY "Authenticated users can view movement history"
ON public.asset_movement_history
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- System can insert movement history (via edge function)
CREATE POLICY "System can insert movement history"
ON public.asset_movement_history
FOR INSERT
WITH CHECK (true);

-- Create index for efficient querying
CREATE INDEX idx_movement_history_asset_id ON public.asset_movement_history(asset_id);
CREATE INDEX idx_movement_history_moved_at ON public.asset_movement_history(moved_at DESC);

-- Enable realtime for movement history
ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_movement_history;

-- Add trigger for updated_at on categories
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();