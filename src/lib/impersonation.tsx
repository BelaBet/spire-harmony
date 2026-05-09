/**
 * Session-based tenant impersonation for Platform Admins.
 * - State lives in React context (NOT localStorage)
 * - Every start/end is recorded in `impersonation_sessions` (auditable)
 * - Only platform admins can start a session (RLS enforces it server-side too)
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type ImpersonationCtx = {
  active: boolean;
  tenantId: string | null;
  sessionId: string | null;
  start: (tenantId: string, reason?: string) => Promise<void>;
  stop: () => Promise<void>;
};

const Ctx = createContext<ImpersonationCtx>({
  active: false, tenantId: null, sessionId: null,
  start: async () => {}, stop: async () => {},
});

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user, isPlatformAdmin } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // End any orphan session on mount (browser was closed mid-impersonation)
  useEffect(() => {
    if (!user || !isPlatformAdmin) return;
    supabase
      .from("impersonation_sessions")
      .update({ ended_at: new Date().toISOString() })
      .is("ended_at", null)
      .eq("impersonator_id", user.id)
      .then(() => {});
  }, [user, isPlatformAdmin]);

  const start = async (tid: string, reason?: string) => {
    if (!user || !isPlatformAdmin) return;
    const { data, error } = await supabase
      .from("impersonation_sessions")
      .insert({
        impersonator_id: user.id,
        tenant_id: tid,
        reason: reason ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    setTenantId(tid);
    setSessionId(data.id);
  };

  const stop = async () => {
    if (sessionId) {
      await supabase
        .from("impersonation_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    setTenantId(null);
    setSessionId(null);
  };

  return (
    <Ctx.Provider value={{ active: !!tenantId, tenantId, sessionId, start, stop }}>
      {children}
    </Ctx.Provider>
  );
}

export const useImpersonation = () => useContext(Ctx);
