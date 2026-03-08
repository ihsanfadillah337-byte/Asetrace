-- Fix search_path for clean_rssi_buffer function
DROP TRIGGER IF EXISTS trigger_clean_rssi_buffer ON ble_rssi_buffer;
DROP FUNCTION IF EXISTS clean_rssi_buffer();

CREATE OR REPLACE FUNCTION clean_rssi_buffer()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER trigger_clean_rssi_buffer
  AFTER INSERT ON ble_rssi_buffer
  FOR EACH ROW
  EXECUTE FUNCTION clean_rssi_buffer();