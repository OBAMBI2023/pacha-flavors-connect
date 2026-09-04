import { supabase } from "@/integrations/supabase/client";

export type TenantDomain = {
  id: string;
  tenant_id: string;
  domain: string;
  is_primary: boolean;
  is_verified: boolean;
  is_active: boolean;
  verification_token: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

const DOMAIN_FORMAT_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Same normalization the DB trigger applies -- lowercase, no scheme, no trailing slash. Applied before every write so the UI never surprises the user with a silently-rewritten value after save. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

export function isValidDomainFormat(domain: string): boolean {
  return DOMAIN_FORMAT_RE.test(domain);
}

/** The DNS TXT host a tenant must publish `verification_token` on to prove ownership -- shown in the Super Admin UI. */
export function verificationHost(domain: string): string {
  return `_saovia-verify.${domain}`;
}

export async function fetchAllTenantDomains(): Promise<TenantDomain[]> {
  const { data, error } = await supabase.from("tenant_domains").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addTenantDomain(tenantId: string, rawDomain: string): Promise<TenantDomain> {
  const domain = normalizeDomain(rawDomain);
  if (!isValidDomainFormat(domain)) throw new Error("Format de domaine invalide (ex. mon-resto.com).");
  const { data, error } = await supabase.from("tenant_domains").insert({ tenant_id: tenantId, domain }).select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("Ce domaine est déjà enregistré.");
    throw error;
  }
  return data;
}

export async function deleteTenantDomain(domainId: string): Promise<void> {
  const { error } = await supabase.from("tenant_domains").delete().eq("id", domainId);
  if (error) throw error;
}

export async function setTenantDomainActive(domainId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("tenant_domains").update({ is_active: isActive }).eq("id", domainId);
  if (error) {
    if (error.code === "23514") throw new Error("Ce domaine doit être vérifié avant de pouvoir être activé.");
    throw error;
  }
}

export async function setPrimaryTenantDomain(domainId: string): Promise<void> {
  const { error } = await supabase.rpc("super_admin_set_primary_domain", { _domain_id: domainId });
  if (error) throw error;
}

/**
 * Real DNS TXT ownership check -- never marks a domain verified just because
 * it exists or responds to HTTP (per spec). Looks up `_saovia-verify.<domain>`
 * via Cloudflare's public DNS-over-HTTPS resolver directly from the browser
 * (no new server component, no new dependency) and requires the TXT value to
 * exactly equal this row's verification_token before flipping is_verified.
 */
export async function verifyTenantDomain(domainRow: TenantDomain): Promise<{ verified: boolean; message: string }> {
  const host = verificationHost(domainRow.domain);
  let records: string[] = [];
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=TXT`, {
      headers: { accept: "application/dns-json" },
    });
    if (!res.ok) throw new Error("dns lookup failed");
    const body = (await res.json()) as { Answer?: { data: string }[] };
    records = (body.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ""));
  } catch {
    return { verified: false, message: "Impossible d'interroger le DNS pour le moment. Réessayez dans quelques instants." };
  }

  if (!records.includes(domainRow.verification_token)) {
    return {
      verified: false,
      message: `Enregistrement TXT introuvable ou incorrect sur ${host}. La propagation DNS peut prendre jusqu'à 24h après l'ajout de l'enregistrement.`,
    };
  }

  const { error } = await supabase
    .from("tenant_domains")
    .update({ is_verified: true, verified_at: new Date().toISOString() })
    .eq("id", domainRow.id);
  if (error) throw error;
  return { verified: true, message: "Domaine vérifié avec succès." };
}

/**
 * Used by the public storefront (SEO canonical/OG tags, QR code) to resolve
 * a tenant's active custom origin. Returns null when no domain is
 * configured, or one is configured but not yet primary+verified+active --
 * callers must then fall back to the shared SAOVIA origin / `/r/{slug}`.
 */
export async function fetchActiveTenantDomain(tenantId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("tenant_domains")
    .select("domain")
    .eq("tenant_id", tenantId)
    .eq("is_primary", true)
    .eq("is_verified", true)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data?.domain ?? null;
}
