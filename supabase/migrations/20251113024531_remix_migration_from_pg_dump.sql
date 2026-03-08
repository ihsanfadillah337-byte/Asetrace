--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'operator',
    'user'
);


--
-- Name: asset_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_category AS ENUM (
    'laptop',
    'server',
    'furniture',
    'vehicle',
    'other'
);


--
-- Name: asset_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_status AS ENUM (
    'active',
    'maintenance',
    'lost',
    'damaged',
    'idle',
    'borrowed'
);


--
-- Name: approve_borrow_request(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_borrow_request(_request_id uuid, _approver_id uuid, _notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _asset_id uuid;
  _user_id uuid;
  _student_id uuid;
  _student_name text;
  _asset_name text;
  _tanggal_pinjam date;
BEGIN
  -- SECURITY: Check if approver has admin or operator role
  IF NOT (public.has_role(_approver_id, 'admin'::app_role) OR public.has_role(_approver_id, 'operator'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and operators can approve borrow requests';
  END IF;

  -- Check if asset is available
  SELECT asset_id, user_id, student_id, tanggal_pinjam
  INTO _asset_id, _user_id, _student_id, _tanggal_pinjam
  FROM borrow_requests
  WHERE id = _request_id;

  IF NOT public.is_asset_available(_asset_id) AND NOT EXISTS (
    SELECT 1 FROM borrow_requests WHERE id = _request_id AND status = 'Pending'
  ) THEN
    RAISE EXCEPTION 'Asset is not available for borrowing';
  END IF;

  SELECT full_name INTO _student_name FROM students WHERE id = _student_id;
  SELECT name INTO _asset_name FROM assets WHERE id = _asset_id;

  -- Update request status
  UPDATE borrow_requests
  SET status = 'Approved',
      approved_by = _approver_id,
      notes = _notes,
      updated_at = now()
  WHERE id = _request_id;

  -- Set status to 'borrowed' when approved
  UPDATE assets
  SET status = 'borrowed',
      last_user = _student_name,
      updated_at = now()
  WHERE id = _asset_id;

  -- Create usage log with actual current time (not scheduled borrow date)
  -- This ensures duration calculation is accurate
  INSERT INTO asset_usage_logs (asset_id, user_id, user_name, started_at, notes)
  VALUES (_asset_id, _user_id, _student_name, now(), 'Approved borrow request');

  -- Audit log
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


--
-- Name: check_asset_availability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_asset_availability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'Pending' THEN
    IF NOT public.is_asset_available(NEW.asset_id) THEN
      RAISE EXCEPTION 'Asset is already being borrowed or has pending request';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: create_notification(uuid, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(_user_id uuid, _type text, _title text, _message text, _related_entity_type text DEFAULT NULL::text, _related_entity_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _notification_id uuid;
BEGIN
  INSERT INTO public.notifications (
    user_id, 
    type, 
    title, 
    message, 
    related_entity_type, 
    related_entity_id
  ) VALUES (
    _user_id,
    _type,
    _title,
    _message,
    _related_entity_type,
    _related_entity_id
  ) RETURNING id INTO _notification_id;
  
  RETURN _notification_id;
END;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY role
  LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );

  -- Insert user role as 'user' by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');

  -- Insert student record with complete data from signup
  INSERT INTO public.students (
    user_id, 
    full_name, 
    nim, 
    program_studi, 
    angkatan
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'nim',
    new.raw_user_meta_data->>'program_studi',
    CASE 
      WHEN new.raw_user_meta_data->>'angkatan' IS NOT NULL 
      THEN (new.raw_user_meta_data->>'angkatan')::integer
      ELSE NULL
    END
  );

  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_asset_available(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_asset_available(_asset_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM borrow_requests
    WHERE asset_id = _asset_id
      AND status IN ('Pending', 'Approved')
  )
$$;


--
-- Name: notify_asset_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_asset_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _title text;
  _message text;
  _admin_ids uuid[];
BEGIN
  -- Only trigger on status changes to lost or damaged
  IF OLD.status = NEW.status OR (NEW.status NOT IN ('lost', 'damaged')) THEN
    RETURN NEW;
  END IF;

  -- Get all admin and operator user_ids
  SELECT ARRAY_AGG(user_id) INTO _admin_ids
  FROM user_roles
  WHERE role IN ('admin', 'operator');

  -- Notify admins about status change
  IF NEW.status = 'lost' THEN
    _title := 'Asset Reported Lost';
    _message := 'Asset "' || NEW.name || '" has been marked as lost. Immediate attention required.';
  ELSIF NEW.status = 'damaged' THEN
    _title := 'Asset Reported Damaged';
    _message := 'Asset "' || NEW.name || '" has been marked as damaged. Maintenance may be required.';
  END IF;

  -- Create notification for each admin
  IF _admin_ids IS NOT NULL THEN
    FOR i IN 1..array_length(_admin_ids, 1) LOOP
      PERFORM create_notification(
        _admin_ids[i],
        'asset_status_changed',
        _title,
        _message,
        'asset',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_borrow_request_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_borrow_request_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _asset_name text;
  _title text;
  _message text;
BEGIN
  -- Only trigger on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get asset name
  SELECT name INTO _asset_name FROM assets WHERE id = NEW.asset_id;

  -- Handle approval
  IF NEW.status = 'Approved' AND OLD.status = 'Pending' THEN
    _title := 'Borrow Request Approved';
    _message := 'Your request to borrow ' || _asset_name || ' has been approved. You can pick it up on ' || TO_CHAR(NEW.tanggal_pinjam, 'DD Mon YYYY') || '.';
    
    PERFORM create_notification(
      NEW.user_id,
      'borrow_approved',
      _title,
      _message,
      'borrow_request',
      NEW.id
    );
  END IF;

  -- Handle rejection
  IF NEW.status = 'Rejected' AND OLD.status = 'Pending' THEN
    _title := 'Borrow Request Rejected';
    _message := 'Your request to borrow ' || _asset_name || ' has been rejected.' || 
                CASE WHEN NEW.notes IS NOT NULL THEN ' Reason: ' || NEW.notes ELSE '' END;
    
    PERFORM create_notification(
      NEW.user_id,
      'borrow_rejected',
      _title,
      _message,
      'borrow_request',
      NEW.id
    );
  END IF;

  -- Handle return
  IF NEW.status = 'Returned' AND OLD.status = 'Approved' THEN
    _title := 'Asset Returned Successfully';
    _message := 'You have successfully returned ' || _asset_name || '. Thank you!';
    
    PERFORM create_notification(
      NEW.user_id,
      'borrow_returned',
      _title,
      _message,
      'borrow_request',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_maintenance_completed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_maintenance_completed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _asset_name text;
  _title text;
  _message text;
  _current_borrower uuid;
BEGIN
  -- Only trigger when status changes to completed
  IF OLD.status = 'completed' OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get asset name
  SELECT name INTO _asset_name FROM assets WHERE id = NEW.asset_id;

  -- Check if asset has active borrower
  SELECT user_id INTO _current_borrower
  FROM borrow_requests
  WHERE asset_id = NEW.asset_id 
    AND status = 'Approved'
  LIMIT 1;

  -- Notify current borrower if exists
  IF _current_borrower IS NOT NULL THEN
    _title := 'Maintenance Completed';
    _message := 'Maintenance for ' || _asset_name || ' has been completed. The asset is now ready for use.';
    
    PERFORM create_notification(
      _current_borrower,
      'maintenance_completed',
      _title,
      _message,
      'maintenance',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: reject_borrow_request(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_borrow_request(_request_id uuid, _approver_id uuid, _notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _asset_id uuid;
  _student_name text;
  _asset_name text;
BEGIN
  -- SECURITY: Check if approver has admin or operator role
  IF NOT (public.has_role(_approver_id, 'admin'::app_role) OR public.has_role(_approver_id, 'operator'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and operators can reject borrow requests';
  END IF;

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


--
-- Name: return_asset(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.return_asset(_request_id uuid, _notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _asset_id uuid;
  _user_id uuid;
  _student_name text;
  _asset_name text;
  _usage_log_id uuid;
  _caller_id uuid;
BEGIN
  -- Get the caller's user ID
  _caller_id := auth.uid();
  
  -- SECURITY: Check if caller has admin or operator role
  IF NOT (public.has_role(_caller_id, 'admin'::app_role) OR public.has_role(_caller_id, 'operator'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and operators can process returns';
  END IF;

  SELECT br.asset_id, br.user_id, s.full_name, a.name
  INTO _asset_id, _user_id, _student_name, _asset_name
  FROM borrow_requests br
  JOIN students s ON s.id = br.student_id
  JOIN assets a ON a.id = br.asset_id
  WHERE br.id = _request_id;

  -- Update request to Returned
  UPDATE borrow_requests
  SET status = 'Returned',
      notes = COALESCE(_notes, notes),
      updated_at = now()
  WHERE id = _request_id;

  -- Set asset back to active
  UPDATE assets
  SET status = 'active',
      updated_at = now()
  WHERE id = _asset_id;

  -- Close usage log
  UPDATE asset_usage_logs
  SET ended_at = now(),
      duration_hours = EXTRACT(EPOCH FROM (now() - started_at)) / 3600,
      notes = COALESCE(_notes, notes)
  WHERE asset_id = _asset_id
    AND user_id = _user_id
    AND ended_at IS NULL
  RETURNING id INTO _usage_log_id;

  -- Audit log
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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: asset_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    user_id uuid,
    user_name text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    duration_hours numeric,
    location text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_positive_duration CHECK (((duration_hours IS NULL) OR (duration_hours >= (0)::numeric)))
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    status public.asset_status DEFAULT 'active'::public.asset_status NOT NULL,
    condition text NOT NULL,
    last_user text,
    category public.asset_category NOT NULL,
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
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_positive_value CHECK (((value IS NULL) OR (value >= (0)::numeric)))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    user_role public.app_role NOT NULL,
    action text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: borrow_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.borrow_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    user_id uuid NOT NULL,
    student_id uuid NOT NULL,
    tanggal_pinjam date NOT NULL,
    tanggal_kembali date NOT NULL,
    alasan text NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    approved_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_return_after_borrow CHECK ((tanggal_kembali >= tanggal_pinjam)),
    CONSTRAINT check_valid_status CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text, 'Returned'::text])))
);

ALTER TABLE ONLY public.borrow_requests REPLICA IDENTITY FULL;


--
-- Name: maintenance_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    maintenance_type text NOT NULL,
    description text,
    technician_name text NOT NULL,
    cost numeric,
    scheduled_date date,
    completed_date date,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_positive_cost CHECK (((cost IS NULL) OR (cost >= (0)::numeric))),
    CONSTRAINT check_valid_status CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read_status boolean DEFAULT false,
    related_entity_type text,
    related_entity_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_related_entity_type_check CHECK ((related_entity_type = ANY (ARRAY['asset'::text, 'borrow_request'::text, 'maintenance'::text, 'usage_log'::text]))),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['borrow_approved'::text, 'borrow_rejected'::text, 'borrow_returned'::text, 'maintenance_due'::text, 'maintenance_completed'::text, 'asset_status_changed'::text, 'usage_alert'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.profiles REPLICA IDENTITY FULL;


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nim text,
    full_name text NOT NULL,
    program_studi text,
    angkatan integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.students REPLICA IDENTITY FULL;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.user_roles REPLICA IDENTITY FULL;


--
-- Name: asset_usage_logs asset_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usage_logs
    ADD CONSTRAINT asset_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: borrow_requests borrow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests
    ADD CONSTRAINT borrow_requests_pkey PRIMARY KEY (id);


--
-- Name: maintenance_history maintenance_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_history
    ADD CONSTRAINT maintenance_history_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: students students_nim_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_nim_key UNIQUE (nim);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: borrow_requests check_borrow_availability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_borrow_availability BEFORE INSERT ON public.borrow_requests FOR EACH ROW EXECUTE FUNCTION public.check_asset_availability();


--
-- Name: assets trigger_notify_asset_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_asset_status AFTER UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.notify_asset_status_change();


--
-- Name: borrow_requests trigger_notify_borrow_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_borrow_request AFTER UPDATE ON public.borrow_requests FOR EACH ROW EXECUTE FUNCTION public.notify_borrow_request_status();


--
-- Name: maintenance_history trigger_notify_maintenance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_maintenance AFTER UPDATE ON public.maintenance_history FOR EACH ROW EXECUTE FUNCTION public.notify_maintenance_completed();


--
-- Name: assets update_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: borrow_requests update_borrow_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_borrow_requests_updated_at BEFORE UPDATE ON public.borrow_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: maintenance_history update_maintenance_history_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_maintenance_history_updated_at BEFORE UPDATE ON public.maintenance_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications update_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: students update_students_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: asset_usage_logs asset_usage_logs_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usage_logs
    ADD CONSTRAINT asset_usage_logs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_usage_logs asset_usage_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usage_logs
    ADD CONSTRAINT asset_usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: borrow_requests borrow_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests
    ADD CONSTRAINT borrow_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: borrow_requests borrow_requests_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests
    ADD CONSTRAINT borrow_requests_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: borrow_requests borrow_requests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests
    ADD CONSTRAINT borrow_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: borrow_requests borrow_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests
    ADD CONSTRAINT borrow_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: maintenance_history maintenance_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_history
    ADD CONSTRAINT maintenance_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: maintenance_history maintenance_history_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_history
    ADD CONSTRAINT maintenance_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: assets Admins and operators can delete assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and operators can delete assets" ON public.assets FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'operator'::public.app_role)));


--
-- Name: maintenance_history Admins and operators can delete maintenance records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and operators can delete maintenance records" ON public.maintenance_history FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'operator'::public.app_role)));


--
-- Name: assets Admins and operators can insert assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and operators can insert assets" ON public.assets FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'operator'::public.app_role)));


--
-- Name: maintenance_history Admins and operators can insert maintenance records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and operators can insert maintenance records" ON public.maintenance_history FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'operator'::public.app_role)));


--
-- Name: assets Admins and operators can update assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and operators can update assets" ON public.assets FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'operator'::public.app_role)));


--
-- Name: borrow_requests Admins and operators can update borrow requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and operators can update borrow requests" ON public.borrow_requests FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'operator'::public.app_role)));


--
-- Name: maintenance_history Admins and operators can update maintenance records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and operators can update maintenance records" ON public.maintenance_history FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'operator'::public.app_role)));


--
-- Name: borrow_requests Admins and operators can view all borrow requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and operators can view all borrow requests" ON public.borrow_requests FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'operator'::public.app_role)));


--
-- Name: borrow_requests Admins can delete borrow requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete borrow requests" ON public.borrow_requests FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: students Admins can manage all student records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all student records" ON public.students USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Admins can view all audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: students Admins can view all student records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all student records" ON public.students FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Authenticated users can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: asset_usage_logs Authenticated users can insert their own usage logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert their own usage logs" ON public.asset_usage_logs FOR INSERT WITH CHECK (((auth.uid() = user_id) OR (auth.uid() IS NOT NULL)));


--
-- Name: assets Authenticated users can view assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view assets" ON public.assets FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: maintenance_history Authenticated users can view maintenance history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view maintenance history" ON public.maintenance_history FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: asset_usage_logs Authenticated users can view usage logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view usage logs" ON public.asset_usage_logs FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: asset_usage_logs Only admins can delete usage logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can delete usage logs" ON public.asset_usage_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: borrow_requests Users can create their own borrow requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own borrow requests" ON public.borrow_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: students Users can insert their own student record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own student record" ON public.students FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: students Users can update their own student record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own student record" ON public.students FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: asset_usage_logs Users can update their own usage logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own usage logs" ON public.asset_usage_logs FOR UPDATE USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: borrow_requests Users can view their own borrow requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own borrow requests" ON public.borrow_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: students Users can view their own student record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own student record" ON public.students FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: asset_usage_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: borrow_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.borrow_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


