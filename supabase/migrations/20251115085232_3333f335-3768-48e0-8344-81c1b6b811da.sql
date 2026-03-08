-- Create rooms table for BLE tracking system
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL UNIQUE,
  room_name text NOT NULL,
  floor text NOT NULL,
  building text DEFAULT 'Main Building',
  area_sqm numeric,
  capacity integer,
  position_x numeric,
  position_y numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view rooms"
  ON public.rooms FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and operators can insert rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "Admins and operators can update rooms"
  ON public.rooms FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "Admins can delete rooms"
  ON public.rooms FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert room data
-- Lantai 1: BB101-BB110
INSERT INTO public.rooms (room_code, room_name, floor, position_x, position_y) VALUES
  ('BB101', 'Ruang Kelas BB101', 'Lantai 1', 50, 50),
  ('BB102', 'Ruang Kelas BB102', 'Lantai 1', 150, 50),
  ('BB103', 'Ruang Kelas BB103', 'Lantai 1', 250, 50),
  ('BB104', 'Ruang Kelas BB104', 'Lantai 1', 350, 50),
  ('BB105', 'Ruang Kelas BB105', 'Lantai 1', 450, 50),
  ('BB106', 'Ruang Kelas BB106', 'Lantai 1', 50, 150),
  ('BB107', 'Ruang Kelas BB107', 'Lantai 1', 150, 150),
  ('BB108', 'Ruang Kelas BB108', 'Lantai 1', 250, 150),
  ('BB109', 'Ruang Kelas BB109', 'Lantai 1', 350, 150),
  ('BB110', 'Ruang Kelas BB110', 'Lantai 1', 450, 150);

-- Lantai 2: BB201-BB204 + Admin
INSERT INTO public.rooms (room_code, room_name, floor, position_x, position_y) VALUES
  ('BB201', 'Ruang Kelas BB201', 'Lantai 2', 50, 50),
  ('BB202', 'Ruang Kelas BB202', 'Lantai 2', 150, 50),
  ('BB203', 'Ruang Kelas BB203', 'Lantai 2', 250, 50),
  ('BB204', 'Ruang Kelas BB204', 'Lantai 2', 350, 50),
  ('ADMIN', 'Ruang Admin', 'Lantai 2', 450, 50);

-- Lantai 3: BB301-BB310
INSERT INTO public.rooms (room_code, room_name, floor, position_x, position_y) VALUES
  ('BB301', 'Ruang Kelas BB301', 'Lantai 3', 50, 50),
  ('BB302', 'Ruang Kelas BB302', 'Lantai 3', 150, 50),
  ('BB303', 'Ruang Kelas BB303', 'Lantai 3', 250, 50),
  ('BB304', 'Ruang Kelas BB304', 'Lantai 3', 350, 50),
  ('BB305', 'Ruang Kelas BB305', 'Lantai 3', 450, 50),
  ('BB306', 'Ruang Kelas BB306', 'Lantai 3', 50, 150),
  ('BB307', 'Ruang Kelas BB307', 'Lantai 3', 150, 150),
  ('BB308', 'Ruang Kelas BB308', 'Lantai 3', 250, 150),
  ('BB309', 'Ruang Kelas BB309', 'Lantai 3', 350, 150),
  ('BB310', 'Ruang Kelas BB310', 'Lantai 3', 450, 150);

-- Create trigger for updated_at
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_rooms_floor ON public.rooms(floor);
CREATE INDEX idx_rooms_room_code ON public.rooms(room_code);