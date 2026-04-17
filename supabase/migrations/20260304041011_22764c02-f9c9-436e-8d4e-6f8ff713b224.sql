
-- Drop existing restrictive INSERT policy
DROP POLICY "Admin inserts notifications" ON public.admin_notifications;

-- Allow any authenticated user to insert notifications
CREATE POLICY "Authenticated users insert notifications"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);
