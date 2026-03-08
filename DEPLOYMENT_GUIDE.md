# Asetrace - Deployment Guide

Complete configuration guide untuk menduplikasi project ke account lain.

---

## 1. SUPABASE API CREDENTIALS

```
SUPABASE_URL=https://edphgyayjyhndtrweyeq.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcGhneWF5anlobmR0cndleWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MTE0MzgsImV4cCI6MjA3NDI4NzQzOH0.PbfYAjFJP3dkvm81q1jt4MzCDhAOuBbJp8tgXVXZeOs
```

**Untuk project baru:**
1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard)
2. Copy `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dari Settings > API
3. Update file `src/integrations/supabase/client.ts` dengan credentials baru

---

## 2. DATABASE SCHEMA (MIGRATIONS)

Jalankan SQL migrations berikut secara berurutan di SQL Editor Supabase:

### Step 1: Create Enums

```sql
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'user');
CREATE TYPE public.asset_status AS ENUM ('active', 'maintenance', 'lost', 'damaged', 'idle');
CREATE TYPE public.asset_category AS ENUM ('laptop', 'server', 'furniture', 'vehicle', 'other');
```

### Step 2: Create Tables

```sql
-- Profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  full_name text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Students table
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nim text NOT NULL UNIQUE,
  full_name text NOT NULL,
  program_studi text NOT NULL,
  angkatan integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Assets table
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status asset_status NOT NULL DEFAULT 'active',
  condition text NOT NULL,
  last_user text,
  category asset_category NOT NULL,
  last_maintenance date,
  value numeric,
  floor text NOT NULL,
  room text NOT NULL,
  room_id text NOT NULL,
  position_x numeric,
  position_y numeric,
  type text NOT NULL,
  image_url text,
  latitude numeric,
  longitude numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Borrow requests table
CREATE TABLE public.borrow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  tanggal_pinjam date NOT NULL,
  tanggal_kembali date NOT NULL,
  alasan text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  approved_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Asset usage logs table
CREATE TABLE public.asset_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_hours numeric,
  location text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Maintenance history table
CREATE TABLE public.maintenance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL,
  description text,
  technician_name text NOT NULL,
  cost numeric,
  scheduled_date date,
  completed_date date,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  user_role app_role NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
```

### Step 3: Enable RLS

```sql
-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
```

### Step 4: Create Functions

```sql
-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY role
  LIMIT 1
$$;

-- Function to approve borrow request
CREATE OR REPLACE FUNCTION public.approve_borrow_request(
  _request_id uuid,
  _approver_id uuid,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _asset_id uuid;
  _user_id uuid;
  _student_id uuid;
  _student_name text;
  _asset_name text;
  _tanggal_pinjam date;
BEGIN
  SELECT asset_id, user_id, student_id, tanggal_pinjam
  INTO _asset_id, _user_id, _student_id, _tanggal_pinjam
  FROM borrow_requests
  WHERE id = _request_id;

  SELECT full_name INTO _student_name FROM students WHERE id = _student_id;
  SELECT name INTO _asset_name FROM assets WHERE id = _asset_id;

  UPDATE borrow_requests
  SET status = 'Approved',
      approved_by = _approver_id,
      notes = _notes,
      updated_at = now()
  WHERE id = _request_id;

  UPDATE assets
  SET status = 'active',
      last_user = _student_name,
      updated_at = now()
  WHERE id = _asset_id;

  INSERT INTO asset_usage_logs (asset_id, user_id, user_name, started_at, notes)
  VALUES (_asset_id, _user_id, _student_name, _tanggal_pinjam, 'Approved borrow request');

  INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
  SELECT 
    _approver_id,
    p.full_name,
    ur.role,
    'approve_borrow',
    jsonb_build_object(
      'request_id', _request_id,
      'asset_id', _asset_id,
      'asset_name', _asset_name,
      'student_name', _student_name,
      'borrow_date', _tanggal_pinjam
    )
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.id = _approver_id
  LIMIT 1;
END;
$$;

-- Function to reject borrow request
CREATE OR REPLACE FUNCTION public.reject_borrow_request(
  _request_id uuid,
  _approver_id uuid,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _asset_id uuid;
  _student_name text;
  _asset_name text;
BEGIN
  SELECT br.asset_id, s.full_name, a.name
  INTO _asset_id, _student_name, _asset_name
  FROM borrow_requests br
  JOIN students s ON s.id = br.student_id
  JOIN assets a ON a.id = br.asset_id
  WHERE br.id = _request_id;

  UPDATE borrow_requests
  SET status = 'Rejected',
      approved_by = _approver_id,
      notes = _notes,
      updated_at = now()
  WHERE id = _request_id;

  INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
  SELECT 
    _approver_id,
    p.full_name,
    ur.role,
    'reject_borrow',
    jsonb_build_object(
      'request_id', _request_id,
      'asset_id', _asset_id,
      'asset_name', _asset_name,
      'student_name', _student_name,
      'notes', _notes
    )
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.id = _approver_id
  LIMIT 1;
END;
$$;

-- Function to return asset
CREATE OR REPLACE FUNCTION public.return_asset(
  _request_id uuid,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _asset_id uuid;
  _user_id uuid;
  _student_name text;
  _asset_name text;
  _usage_log_id uuid;
BEGIN
  SELECT br.asset_id, br.user_id, s.full_name, a.name
  INTO _asset_id, _user_id, _student_name, _asset_name
  FROM borrow_requests br
  JOIN students s ON s.id = br.student_id
  JOIN assets a ON a.id = br.asset_id
  WHERE br.id = _request_id;

  UPDATE borrow_requests
  SET status = 'Returned',
      notes = COALESCE(_notes, notes),
      updated_at = now()
  WHERE id = _request_id;

  UPDATE assets
  SET status = 'active',
      updated_at = now()
  WHERE id = _asset_id;

  UPDATE asset_usage_logs
  SET ended_at = now(),
      duration_hours = EXTRACT(EPOCH FROM (now() - started_at)) / 3600,
      notes = COALESCE(_notes, notes)
  WHERE asset_id = _asset_id
    AND user_id = _user_id
    AND ended_at IS NULL
  RETURNING id INTO _usage_log_id;

  INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
  VALUES (
    _user_id,
    _student_name,
    'user',
    'return_asset',
    jsonb_build_object(
      'request_id', _request_id,
      'asset_id', _asset_id,
      'asset_name', _asset_name,
      'usage_log_id', _usage_log_id
    )
  );
END;
$$;
```

### Step 5: Create Triggers

```sql
-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_borrow_requests_updated_at
  BEFORE UPDATE ON public.borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_history_updated_at
  BEFORE UPDATE ON public.maintenance_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## 3. ROW LEVEL SECURITY (RLS) POLICIES

```sql
-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Students policies
CREATE POLICY "Users can view their own student record"
  ON public.students FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own student record"
  ON public.students FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own student record"
  ON public.students FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all student records"
  ON public.students FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all student records"
  ON public.students FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Assets policies
CREATE POLICY "Authenticated users can view assets"
  ON public.assets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and operators can insert assets"
  ON public.assets FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins and operators can update assets"
  ON public.assets FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins and operators can delete assets"
  ON public.assets FOR DELETE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

-- Borrow requests policies
CREATE POLICY "Users can view their own borrow requests"
  ON public.borrow_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own borrow requests"
  ON public.borrow_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and operators can view all borrow requests"
  ON public.borrow_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins and operators can update borrow requests"
  ON public.borrow_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins can delete borrow requests"
  ON public.borrow_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Asset usage logs policies
CREATE POLICY "Authenticated users can view usage logs"
  ON public.asset_usage_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert their own usage logs"
  ON public.asset_usage_logs FOR INSERT
  WITH CHECK ((auth.uid() = user_id) OR (auth.uid() IS NOT NULL));

CREATE POLICY "Users can update their own usage logs"
  ON public.asset_usage_logs FOR UPDATE
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'));

-- Maintenance history policies
CREATE POLICY "Authenticated users can view maintenance history"
  ON public.maintenance_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and operators can insert maintenance records"
  ON public.maintenance_history FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins and operators can update maintenance records"
  ON public.maintenance_history FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins and operators can delete maintenance records"
  ON public.maintenance_history FOR DELETE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

-- Audit logs policies
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
```

---

## 4. STORAGE BUCKETS

**Tidak ada storage buckets yang aktif saat ini.**

Untuk menambahkan storage (contoh untuk asset images):

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('asset-images', 'asset-images', true);

-- RLS policies for storage
CREATE POLICY "Anyone can view asset images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asset-images');

CREATE POLICY "Admins can upload asset images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'asset-images' AND
    has_role(auth.uid(), 'admin')
  );
```

---

## 5. AUTHENTICATION SETTINGS

### Providers Aktif:
- ✅ Email/Password (default)

### Email Templates:
Menggunakan default Supabase templates.

### Trigger Function:
✅ `handle_new_user()` - Otomatis membuat profile saat signup

### URL Configuration:
Di Supabase Dashboard > Authentication > URL Configuration:
- **Site URL**: Set ke production URL atau preview URL
- **Redirect URLs**: Tambahkan semua domain yang valid

---

## 6. EDGE FUNCTIONS

**Tidak ada edge functions yang aktif saat ini.**

Sistem menggunakan database functions (RPC) untuk business logic.

---

## 7. SECRETS / ENVIRONMENT VARIABLES

### Secrets yang digunakan:
- `SUPABASE_URL` - URL project Supabase
- `SUPABASE_PUBLISHABLE_KEY` - Anon key untuk client
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin)
- `SUPABASE_DB_URL` - Database connection string

**Tidak ada third-party API keys** (Resend, Stripe, OpenAI, dll) yang digunakan saat ini.

---

## 8. CARA MEMBUAT USER ADMIN PERTAMA

Setelah setup database, buat admin pertama:

```sql
-- 1. Daftarkan user via signup UI atau jalankan:
-- (Ganti dengan email dan password yang diinginkan)

-- 2. Setelah user terdaftar, set role admin:
INSERT INTO public.user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
  'admin'
);
```

---

## 9. DEMO USERS

Untuk testing, buat user dengan berbagai role:

```sql
-- Setelah signup manual, tambahkan role:

-- Admin user
INSERT INTO public.user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
  'admin'
);

-- Operator user
INSERT INTO public.user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'operator@example.com'),
  'operator'
);

-- Regular user (mahasiswa)
INSERT INTO public.user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'student@example.com'),
  'user'
);

-- Tambahkan data student untuk user mahasiswa
INSERT INTO public.students (user_id, nim, full_name, program_studi, angkatan)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'student@example.com'),
  '1234567890',
  'John Doe',
  'Teknik Informatika',
  2024
);
```

---

## 10. CHECKLIST DEPLOYMENT

- [ ] Buat project Supabase baru
- [ ] Copy credentials ke `src/integrations/supabase/client.ts`
- [ ] Jalankan semua SQL migrations (Step 1-5)
- [ ] Set RLS policies
- [ ] Konfigurasi Authentication URLs
- [ ] Buat admin user pertama
- [ ] Test login dengan berbagai role
- [ ] Test borrow request flow
- [ ] Verify real-time updates berfungsi

---

## 11. FITUR UTAMA SISTEM

### ✅ Implemented:
- Login/Register dengan role-based access (admin, operator, user)
- Asset management (CRUD)
- Borrow request system dengan approval workflow
- Real-time updates menggunakan Supabase realtime
- Audit logging untuk semua aksi penting
- Weekly usage analytics
- Maintenance tracking
- User/Student management

### ⏳ Belum Diimplementasikan:
- IoT tracking (ESP32 BLE)
- QR Code tagging
- 3D Digital Twin view
- Email notifications (Resend integration)
- File upload untuk asset images

---

## Support

Untuk pertanyaan atau issues, hubungi tim development.
