ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

-- Allow members to view in-app broadcast messages targeted to their tenant
CREATE POLICY messages_member_select_inapp ON public.messages
FOR SELECT USING (
  channel = 'in_app'
  AND tenant_id = public.current_tenant_id()
  AND (
    target_type = 'broadcast'
    OR (target_type = 'individual' AND target_id = auth.uid())
    OR (target_type = 'group' AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = messages.target_id AND gm.profile_id = auth.uid()
    ))
  )
);