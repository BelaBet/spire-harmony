import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

const TenantContext = createContext<{ tenant: Tenant | null; loading: boolean }>({
  tenant: null,
  loading: true,
});

function hexToOklch(hex: string): string | null {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return null;
  const [r, g, b] = m.map((h) => parseInt(h, 16) / 255);
  // simple sRGB -> approximate oklch using direct CSS color() — leave to CSS engine via raw hex
  return hex;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug =
      (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("t")) ||
      "default";
    supabase
      .from("tenants")
      .select("id,name,slug,logo_url,primary_color,secondary_color")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        setTenant(data as Tenant | null);
        if (data?.primary_color) {
          document.documentElement.style.setProperty("--brand-primary", data.primary_color);
        }
        if (data?.secondary_color) {
          document.documentElement.style.setProperty("--brand-secondary", data.secondary_color);
        }
        setLoading(false);
        hexToOklch; // keep linter happy
      });
  }, []);

  return <TenantContext.Provider value={{ tenant, loading }}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);
