-- Create trigger to handle new user signup
-- This trigger will automatically create profiles, user_roles, and students records
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();