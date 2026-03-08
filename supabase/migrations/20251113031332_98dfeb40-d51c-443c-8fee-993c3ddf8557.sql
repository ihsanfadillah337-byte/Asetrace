-- Fix search_path for security functions
-- This ensures functions cannot be exploited via search_path manipulation

-- Fix check_asset_availability function
CREATE OR REPLACE FUNCTION public.check_asset_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'Pending' THEN
    IF NOT public.is_asset_available(NEW.asset_id) THEN
      RAISE EXCEPTION 'Asset is already being borrowed or has pending request';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_asset_status_change function
CREATE OR REPLACE FUNCTION public.notify_asset_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix notify_borrow_request_status function
CREATE OR REPLACE FUNCTION public.notify_borrow_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix notify_maintenance_completed function
CREATE OR REPLACE FUNCTION public.notify_maintenance_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;