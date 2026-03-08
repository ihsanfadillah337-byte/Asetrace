-- Create storage bucket for asset images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('asset-images', 'asset-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Public can view asset images"
ON storage.objects FOR SELECT
USING (bucket_id = 'asset-images');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload asset images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'asset-images' 
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to update their uploads
CREATE POLICY "Authenticated users can update asset images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'asset-images' 
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to delete
CREATE POLICY "Authenticated users can delete asset images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'asset-images' 
  AND auth.role() = 'authenticated'
);