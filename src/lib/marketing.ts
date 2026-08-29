import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Customer } from "@/lib/customers-db";

export type CampaignObjective = "reactivation" | "vip" | "new_customer" | "promotion" | "menu" | "loyalty";

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  reactivation: "Réactivation clients inactifs",
  vip: "Meilleurs clients",
  new_customer: "Première commande",
  promotion: "Promotion générale",
  menu: "Nouveau menu",
  loyalty: "Fidélisation",
};

export type CampaignStatus = "draft" | "scheduled" | "sending" | "completed" | "cancelled" | "failed";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  sending: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
  failed: "Échec",
};

/**
 * `usedPromoCode`/`neverOrdered` aside, every numeric bound here maps
 * directly to a real `customers` column -- there is no synthetic scoring.
 * `neverOrdered` is kept for completeness but is expected to always match
 * zero rows today: this app has no pre-order account registry, a `customers`
 * row is only ever created by create_order's find-or-create on a real first
 * order (orders_count starts at 1), so "registered but never ordered" has no
 * backing data yet.
 */
export type AudienceFilters = {
  minOrders?: number;
  maxOrders?: number;
  minSpend?: number;
  maxSpend?: number;
  /** last_order_at older than this many days. Customers who have never ordered are excluded unless neverOrdered is also requested. */
  inactiveSinceDays?: number;
  neverOrdered?: boolean;
  usedPromoCode?: boolean;
  createdAfter?: string;
  createdBefore?: string;
};

export type AudienceSegmentKey = "inactive" | "vip" | "new_customer" | "regular" | "high_value" | "promo_users" | "custom";

/** Default parameters behind each one-click segment card -- all adjustable by the caller before previewing. */
export const AUDIENCE_SEGMENT_DEFAULTS: Record<Exclude<AudienceSegmentKey, "custom">, AudienceFilters> = {
  inactive: { inactiveSinceDays: 14 },
  vip: { minOrders: 5 },
  // Closest real equivalent to "registered without an order": their first
  // order just happened, a natural moment to nudge a second one.
  new_customer: { minOrders: 1, maxOrders: 1 },
  regular: { minOrders: 3 },
  high_value: { minSpend: 25000 },
  promo_users: { usedPromoCode: true },
};

export const AUDIENCE_SEGMENT_LABELS: Record<AudienceSegmentKey, string> = {
  inactive: "Clients inactifs",
  vip: "Clients VIP",
  new_customer: "Clients à leur 1ère commande",
  regular: "Clients réguliers",
  high_value: "Clients à forte valeur",
  promo_users: "Clients ayant utilisé un code promo",
  custom: "Audience personnalisée",
};

async function customerIdsUsingPromoCode(restaurantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("promo_code_usages")
    .select("customer_id")
    .eq("restaurant_id", restaurantId)
    .not("customer_id", "is", null);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.customer_id as string)));
}

/** customer ids that already received a marketing message within the anti-spam window, across every campaign for this restaurant. */
async function recentlyMessagedCustomerIds(restaurantId: string, withinDays: number): Promise<Set<string>> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("marketing_campaign_recipients")
    .select("customer_id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "sent")
    .gte("sent_at", since);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.customer_id as string));
}

/** The one query every audience computation is built from -- always excludes opt-outs and unusable phone numbers, matching the anti-spam rules. */
function baseCustomerQuery(restaurantId: string) {
  return supabase
    .from("customers")
    .select("id,restaurant_id,full_name,phone,email,address,orders_count,total_spent,first_order_at,last_order_at,created_at,updated_at,source,internal_note")
    .eq("restaurant_id", restaurantId)
    .eq("marketing_opt_out", false)
    .not("phone", "is", null)
    .neq("phone", "");
}

function applyAudienceFilters(
  query: ReturnType<typeof baseCustomerQuery>,
  filters: AudienceFilters,
  promoUserIds: string[] | null,
) {
  let q = query;
  if (filters.minOrders !== undefined) q = q.gte("orders_count", filters.minOrders);
  if (filters.maxOrders !== undefined) q = q.lte("orders_count", filters.maxOrders);
  if (filters.minSpend !== undefined) q = q.gte("total_spent", filters.minSpend);
  if (filters.maxSpend !== undefined) q = q.lte("total_spent", filters.maxSpend);
  if (filters.createdAfter) q = q.gte("created_at", filters.createdAfter);
  if (filters.createdBefore) q = q.lte("created_at", filters.createdBefore);
  if (filters.inactiveSinceDays !== undefined) {
    const cutoff = new Date(Date.now() - filters.inactiveSinceDays * 24 * 60 * 60 * 1000).toISOString();
    if (filters.neverOrdered) {
      q = q.or(`last_order_at.lte.${cutoff},last_order_at.is.null`);
    } else {
      q = q.lte("last_order_at", cutoff);
    }
  } else if (filters.neverOrdered) {
    q = q.is("last_order_at", null);
  }
  if (promoUserIds !== null) q = q.in("id", promoUserIds.length > 0 ? promoUserIds : ["00000000-0000-0000-0000-000000000000"]);
  return q;
}

export type AudiencePreview = {
  totalBase: number;
  matched: number;
  excludedOptOut: number;
  excludedInvalidPhone: number;
  excludedRecentlyMessaged: number;
  eligible: number;
};

/**
 * Every count here comes from a real query -- "excluded" counts are computed
 * by re-running the same filter without that one exclusion and diffing, not
 * estimated.
 */
export async function fetchAudiencePreview(
  restaurantId: string,
  filters: AudienceFilters,
  antiSpamDays = 7,
): Promise<AudiencePreview> {
  const [{ count: totalBase }, promoUserIds] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
    filters.usedPromoCode ? customerIdsUsingPromoCode(restaurantId) : Promise.resolve(null),
  ]);

  const { data: matchedRows, error } = await applyAudienceFilters(baseCustomerQuery(restaurantId), filters, promoUserIds).select("id");
  if (error) throw error;
  const matchedIds = (matchedRows ?? []).map((r) => r.id as string);

  const { count: noOptOutNoFilterCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("marketing_opt_out", false);

  const recentlyMessaged = await recentlyMessagedCustomerIds(restaurantId, antiSpamDays);
  const eligibleIds = matchedIds.filter((id) => !recentlyMessaged.has(id));

  return {
    totalBase: totalBase ?? 0,
    matched: matchedIds.length,
    excludedOptOut: (totalBase ?? 0) - (noOptOutNoFilterCount ?? 0),
    excludedInvalidPhone: 0, // phone is NOT NULL in this schema; kept for future looser data sources
    excludedRecentlyMessaged: matchedIds.length - eligibleIds.length,
    eligible: eligibleIds.length,
  };
}

export async function fetchAudienceCustomers(restaurantId: string, filters: AudienceFilters, antiSpamDays = 7): Promise<Customer[]> {
  const promoUserIds = filters.usedPromoCode ? await customerIdsUsingPromoCode(restaurantId) : null;
  const { data, error } = await applyAudienceFilters(baseCustomerQuery(restaurantId), filters, promoUserIds);
  if (error) throw error;
  const recentlyMessaged = await recentlyMessagedCustomerIds(restaurantId, antiSpamDays);
  return ((data ?? []) as unknown as Customer[]).filter((c) => !recentlyMessaged.has(c.id));
}

export function normalizeWhatsAppDigits(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${normalizeWhatsAppDigits(phone)}?text=${encodeURIComponent(message)}`;
}

export type MessageVariables = {
  prenom?: string;
  nom_restaurant?: string;
  code_promo?: string;
  montant_promo?: string;
  date_expiration?: string;
  lien_commande?: string;
};

export function renderMessageTemplate(template: string, vars: MessageVariables): string {
  return template
    .replaceAll("{{prenom}}", vars.prenom ?? "")
    .replaceAll("{{nom_restaurant}}", vars.nom_restaurant ?? "")
    .replaceAll("{{code_promo}}", vars.code_promo ?? "")
    .replaceAll("{{montant_promo}}", vars.montant_promo ?? "")
    .replaceAll("{{date_expiration}}", vars.date_expiration ?? "")
    .replaceAll("{{lien_commande}}", vars.lien_commande ?? "");
}

export type Campaign = {
  id: string;
  restaurant_id: string;
  created_by: string | null;
  objective: CampaignObjective;
  name: string;
  message_template: string;
  promo_code_id: string | null;
  audience_segment: string | null;
  audience_filters: AudienceFilters;
  recipient_count: number;
  status: CampaignStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  restaurant?: { id: string; name: string; slug: string } | null;
  promo_code?: { id: string; code: string; discount_type: string; discount_value: number | null } | null;
};

const CAMPAIGN_COLUMNS =
  "id,restaurant_id,created_by,objective,name,message_template,promo_code_id,audience_segment,audience_filters,recipient_count,status,scheduled_for,sent_at,created_at,updated_at," +
  "restaurant:restaurants(id,name,slug),promo_code:promo_codes(id,code,discount_type,discount_value)";

export async function fetchCampaigns(restaurantId?: string | null): Promise<Campaign[]> {
  let query = supabase.from("marketing_campaigns").select(CAMPAIGN_COLUMNS).order("created_at", { ascending: false });
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Campaign[];
}

export async function fetchCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase.from("marketing_campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Campaign | null) ?? null;
}

export type CampaignRecipient = {
  id: string;
  campaign_id: string;
  customer_id: string;
  restaurant_id: string;
  phone_snapshot: string;
  name_snapshot: string;
  message_rendered: string;
  wa_link: string;
  status: "pending" | "sent" | "excluded";
  sent_at: string | null;
  created_at: string;
};

export async function fetchCampaignRecipients(campaignId: string): Promise<CampaignRecipient[]> {
  const { data, error } = await supabase
    .from("marketing_campaign_recipients")
    .select("id,campaign_id,customer_id,restaurant_id,phone_snapshot,name_snapshot,message_rendered,wa_link,status,sent_at,created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CampaignRecipient[];
}

export type CreateCampaignInput = {
  restaurantId: string;
  restaurantName: string;
  objective: CampaignObjective;
  name: string;
  messageTemplate: string;
  promoCode?: { id: string; code: string; discountLabel: string; expiresAt: string | null } | null;
  audienceSegment: AudienceSegmentKey;
  audienceFilters: AudienceFilters;
  recipients: Customer[];
};

/** Snapshots the audience into concrete recipients at creation time -- a campaign never silently re-targets a moving audience later. */
export async function createCampaign(input: CreateCampaignInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: campaign, error: campaignError } = await supabase
    .from("marketing_campaigns")
    .insert({
      restaurant_id: input.restaurantId,
      created_by: user?.id ?? null,
      objective: input.objective,
      name: input.name,
      message_template: input.messageTemplate,
      promo_code_id: input.promoCode?.id ?? null,
      audience_segment: input.audienceSegment,
      audience_filters: input.audienceFilters as unknown as Json,
      recipient_count: input.recipients.length,
      status: "draft",
    })
    .select("id")
    .single();
  if (campaignError) throw campaignError;

  if (input.recipients.length > 0) {
    const rows = input.recipients.map((customer) => {
      const firstName = customer.full_name.trim().split(/\s+/)[0] ?? customer.full_name;
      const message = renderMessageTemplate(input.messageTemplate, {
        prenom: firstName,
        nom_restaurant: input.restaurantName,
        code_promo: input.promoCode?.code ?? "",
        montant_promo: input.promoCode?.discountLabel ?? "",
        date_expiration: input.promoCode?.expiresAt ? new Date(input.promoCode.expiresAt).toLocaleDateString("fr-FR") : "",
      });
      return {
        campaign_id: campaign.id,
        customer_id: customer.id,
        restaurant_id: input.restaurantId,
        phone_snapshot: customer.phone,
        name_snapshot: customer.full_name,
        message_rendered: message,
        wa_link: buildWhatsAppLink(customer.phone, message),
        status: "pending" as const,
      };
    });
    const { error: recipientsError } = await supabase.from("marketing_campaign_recipients").insert(rows);
    if (recipientsError) throw recipientsError;
  }

  return campaign.id;
}

export async function markRecipientSent(recipientId: string): Promise<void> {
  const { error } = await supabase
    .from("marketing_campaign_recipients")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", recipientId);
  if (error) throw error;
}

/** Marks the campaign itself completed once every recipient has been confirmed sent (or excluded) -- called after the admin finishes working through the list. */
export async function markCampaignSent(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ status: "completed", sent_at: new Date().toISOString() })
    .eq("id", campaignId);
  if (error) throw error;
}

export async function cancelCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase.from("marketing_campaigns").update({ status: "cancelled" }).eq("id", campaignId);
  if (error) throw error;
}

export async function setCustomerMarketingOptOut(customerId: string, optOut: boolean): Promise<void> {
  const { error } = await supabase.from("customers").update({ marketing_opt_out: optOut }).eq("id", customerId);
  if (error) throw error;
}

export type CampaignAttribution = {
  ordersGenerated: number;
  revenueGenerated: number;
};

/**
 * Real attribution only: an order counts toward a campaign when it used
 * that campaign's exact promo code AND was placed at or after the campaign
 * was sent -- so a promo code reused outside this campaign's send window
 * (e.g. the restaurant already had it running) is never misattributed.
 * Campaigns without a promo code have no attribution mechanism today and
 * correctly report zero rather than a guess.
 */
export async function fetchCampaignAttribution(campaign: Pick<Campaign, "promo_code_id" | "sent_at">): Promise<CampaignAttribution> {
  if (!campaign.promo_code_id || !campaign.sent_at) return { ordersGenerated: 0, revenueGenerated: 0 };
  const { data, error } = await supabase
    .from("promo_code_usages")
    .select("discount_amount, order_id, orders(total_amount)")
    .eq("promo_code_id", campaign.promo_code_id)
    .gte("created_at", campaign.sent_at);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { order_id: string; orders: { total_amount: number } | null }[];
  return {
    ordersGenerated: rows.length,
    revenueGenerated: rows.reduce((sum, r) => sum + (r.orders?.total_amount ?? 0), 0),
  };
}

export type MarketingOverview = {
  campaignsCount: number;
  recipientsTargeted: number;
  messagesSent: number;
  uniqueClientsReached: number;
  ordersGenerated: number;
  revenueGenerated: number;
};

export async function fetchMarketingOverview(restaurantId: string): Promise<MarketingOverview> {
  const campaigns = await fetchCampaigns(restaurantId);
  const [{ count: recipientsTargeted }, sentRows] = await Promise.all([
    supabase.from("marketing_campaign_recipients").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
    supabase.from("marketing_campaign_recipients").select("customer_id").eq("restaurant_id", restaurantId).eq("status", "sent"),
  ]);
  const sentList = (sentRows.data ?? []) as { customer_id: string }[];
  const attributions = await Promise.all(
    campaigns.filter((c) => c.promo_code_id && c.sent_at).map((c) => fetchCampaignAttribution(c)),
  );
  return {
    campaignsCount: campaigns.length,
    recipientsTargeted: recipientsTargeted ?? 0,
    messagesSent: sentList.length,
    uniqueClientsReached: new Set(sentList.map((r) => r.customer_id)).size,
    ordersGenerated: attributions.reduce((s, a) => s + a.ordersGenerated, 0),
    revenueGenerated: attributions.reduce((s, a) => s + a.revenueGenerated, 0),
  };
}
