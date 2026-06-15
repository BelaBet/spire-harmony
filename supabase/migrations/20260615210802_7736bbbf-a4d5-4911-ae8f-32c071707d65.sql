GRANT SELECT ON public.events TO anon;

CREATE POLICY "events_public_active_select"
ON public.events
FOR SELECT
TO anon, authenticated
USING (status <> 'draft'::event_status);