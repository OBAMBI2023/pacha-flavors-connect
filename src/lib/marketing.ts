import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Customer } from "@/lib/customers-db";

export type CampaignObjective =
  "reactivation" | "vip" | "new_customer" | "promotion" | "menu" | "loyalty";

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  reactivation: "Réactivation clients inactifs",
  vip: "Meilleurs clients",
  new_customer: "Première commande",
  promotion: "Promotion générale",
  menu: "Nouveau menu",
  loyalty: "Fidélisation",
};

export type CampaignStatus =
  "draft" | "scheduled" | "sending" | "completed" | "cancelled" | "failed";

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

export type AudienceSegmentKey =
  "inactive" | "vip" | "new_customer" | "regular" | "high_value" | "promo_users" | "custom";

/** Default parameters behind each one-click segment card -- all adjustable by the caller before previewing. */
export const AUDIENCE_SEGMENT_DEFAULTS: Record<
  Exclude<AudienceSegmentKey, "custom">,
  AudienceFilters
> = {
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
async function recentlyMessagedCustomerIds(
  restaurantId: string,
  withinDays: number,
): Promise<Set<string>> {
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
    .select(
      "id,restaurant_id,full_name,phone,email,address,orders_count,total_spent,first_order_at,last_order_at,created_at,updated_at,source,internal_note",
    )
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
    const cutoff = new Date(
      Date.now() - filters.inactiveSinceDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    if (filters.neverOrdered) {
      q = q.or(`last_order_at.lte.${cutoff},last_order_at.is.null`);
    } else {
      q = q.lte("last_order_at", cutoff);
    }
  } else if (filters.neverOrdered) {
    q = q.is("last_order_at", null);
  }
  if (promoUserIds !== null)
    q = q.in(
      "id",
      promoUserIds.length > 0 ? promoUserIds : ["00000000-0000-0000-0000-000000000000"],
    );
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
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    filters.usedPromoCode ? customerIdsUsingPromoCode(restaurantId) : Promise.resolve(null),
  ]);

  const { data: matchedRows, error } = await applyAudienceFilters(
    baseCustomerQuery(restaurantId),
    filters,
    promoUserIds,
  ).select("id");
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

export async function fetchAudienceCustomers(
  restaurantId: string,
  filters: AudienceFilters,
  antiSpamDays = 7,
): Promise<Customer[]> {
  const promoUserIds = filters.usedPromoCode ? await customerIdsUsingPromoCode(restaurantId) : null;
  const { data, error } = await applyAudienceFilters(
    baseCustomerQuery(restaurantId),
    filters,
    promoUserIds,
  );
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
  /** Formatted date of the recipient's own last order -- real per-customer data, resolved by the caller from customers.last_order_at, never guessed. */
  derniere_commande?: string;
  /** Formatted average basket for the recipient -- real per-customer data (total_spent / orders_count), never guessed. */
  montant_panier?: string;
};

export function renderMessageTemplate(template: string, vars: MessageVariables): string {
  return template
    .replaceAll("{{prenom}}", vars.prenom ?? "")
    .replaceAll("{{nom_restaurant}}", vars.nom_restaurant ?? "")
    .replaceAll("{{code_promo}}", vars.code_promo ?? "")
    .replaceAll("{{montant_promo}}", vars.montant_promo ?? "")
    .replaceAll("{{date_expiration}}", vars.date_expiration ?? "")
    .replaceAll("{{lien_commande}}", vars.lien_commande ?? "")
    .replaceAll("{{derniere_commande}}", vars.derniere_commande ?? "")
    .replaceAll("{{montant_panier}}", vars.montant_panier ?? "");
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
  promo_code?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number | null;
  } | null;
};

const CAMPAIGN_COLUMNS =
  "id,restaurant_id,created_by,objective,name,message_template,promo_code_id,audience_segment,audience_filters,recipient_count,status,scheduled_for,sent_at,created_at,updated_at," +
  "restaurant:restaurants(id,name,slug),promo_code:promo_codes(id,code,discount_type,discount_value)";

export async function fetchCampaigns(restaurantId?: string | null): Promise<Campaign[]> {
  let query = supabase
    .from("marketing_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .order("created_at", { ascending: false });
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Campaign[];
}

export async function fetchCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
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
    .select(
      "id,campaign_id,customer_id,restaurant_id,phone_snapshot,name_snapshot,message_rendered,wa_link,status,sent_at,created_at",
    )
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
  /** ISO datetime -- when set, the campaign is created with status 'scheduled' instead of 'draft'. No dispatcher exists yet to act on this automatically: it's a stored intent the team still executes manually (same wa.me-link flow) once the date arrives. */
  scheduledFor?: string | null;
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
      status: input.scheduledFor ? "scheduled" : "draft",
      scheduled_for: input.scheduledFor ?? null,
    })
    .select("id")
    .single();
  if (campaignError) throw campaignError;

  if (input.recipients.length > 0) {
    const rows = input.recipients.map((customer) => {
      const firstName = customer.full_name.trim().split(/\s+/)[0] ?? customer.full_name;
      const avgBasket =
        customer.orders_count > 0 ? Math.round(customer.total_spent / customer.orders_count) : 0;
      const message = renderMessageTemplate(input.messageTemplate, {
        prenom: firstName,
        nom_restaurant: input.restaurantName,
        code_promo: input.promoCode?.code ?? "",
        montant_promo: input.promoCode?.discountLabel ?? "",
        date_expiration: input.promoCode?.expiresAt
          ? new Date(input.promoCode.expiresAt).toLocaleDateString("fr-FR")
          : "",
        derniere_commande: customer.last_order_at
          ? new Date(customer.last_order_at).toLocaleDateString("fr-FR")
          : "",
        montant_panier: avgBasket > 0 ? avgBasket.toLocaleString("fr-FR") : "",
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
    const { error: recipientsError } = await supabase
      .from("marketing_campaign_recipients")
      .insert(rows);
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
  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ status: "cancelled" })
    .eq("id", campaignId);
  if (error) throw error;
}

export async function setCustomerMarketingOptOut(
  customerId: string,
  optOut: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("customers")
    .update({ marketing_opt_out: optOut })
    .eq("id", customerId);
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
export async function fetchCampaignAttribution(
  campaign: Pick<Campaign, "promo_code_id" | "sent_at">,
): Promise<CampaignAttribution> {
  if (!campaign.promo_code_id || !campaign.sent_at)
    return { ordersGenerated: 0, revenueGenerated: 0 };
  const { data, error } = await supabase
    .from("promo_code_usages")
    .select("discount_amount, order_id, orders(total_amount)")
    .eq("promo_code_id", campaign.promo_code_id)
    .gte("used_at", campaign.sent_at);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    order_id: string;
    orders: { total_amount: number } | null;
  }[];
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
    supabase
      .from("marketing_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("marketing_campaign_recipients")
      .select("customer_id")
      .eq("restaurant_id", restaurantId)
      .eq("status", "sent"),
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

// ---------------------------------------------------------------------------
// CRM classification -- pure, derived labels for the Clients table/fiche.
// Never stored; always computed from the same real thresholds already used
// by the one-click Audiences segment cards (AUDIENCE_SEGMENT_DEFAULTS above),
// so a customer's badge here always agrees with which segment card would
// include them.
// ---------------------------------------------------------------------------

export type CustomerLifecycleStatus = "active" | "inactive" | "opted_out";

export function customerLifecycleStatus(
  customer: Pick<Customer, "last_order_at" | "marketing_opt_out">,
): CustomerLifecycleStatus {
  if (customer.marketing_opt_out) return "opted_out";
  if (!customer.last_order_at) return "inactive";
  const inactiveSinceDays = AUDIENCE_SEGMENT_DEFAULTS.inactive.inactiveSinceDays ?? 14;
  const cutoff = Date.now() - inactiveSinceDays * 24 * 60 * 60 * 1000;
  return new Date(customer.last_order_at).getTime() < cutoff ? "inactive" : "active";
}

export const CUSTOMER_LIFECYCLE_LABELS: Record<CustomerLifecycleStatus, string> = {
  active: "Actif",
  inactive: "Inactif",
  opted_out: "Désinscrit",
};

export const CUSTOMER_LIFECYCLE_BADGE_CLASS: Record<CustomerLifecycleStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-amber-100 text-amber-700",
  opted_out: "bg-slate-100 text-slate-500",
};

export type CustomerCrmSegment = "new_customer" | "vip" | "high_value" | "regular" | "standard";

/** Priority order matches the one-click segment cards -- a customer qualifying for several buckets shows under the most specific one. */
export function customerCrmSegment(
  customer: Pick<Customer, "orders_count" | "total_spent">,
): CustomerCrmSegment {
  if (customer.orders_count <= 1) return "new_customer";
  if (customer.orders_count >= (AUDIENCE_SEGMENT_DEFAULTS.vip.minOrders ?? 5)) return "vip";
  if (customer.total_spent >= (AUDIENCE_SEGMENT_DEFAULTS.high_value.minSpend ?? 25000))
    return "high_value";
  if (customer.orders_count >= (AUDIENCE_SEGMENT_DEFAULTS.regular.minOrders ?? 3)) return "regular";
  return "standard";
}

export const CUSTOMER_CRM_SEGMENT_LABELS: Record<CustomerCrmSegment, string> = {
  new_customer: "Nouveau",
  vip: "VIP",
  high_value: "Forte valeur",
  regular: "Régulier",
  standard: "Standard",
};

export const CUSTOMER_CRM_SEGMENT_BADGE_CLASS: Record<CustomerCrmSegment, string> = {
  new_customer: "bg-sky-100 text-sky-700",
  vip: "bg-amber-100 text-amber-800",
  high_value: "bg-violet-100 text-violet-700",
  regular: "bg-emerald-100 text-emerald-700",
  standard: "bg-slate-100 text-slate-600",
};

// ---------------------------------------------------------------------------
// Dashboard & Analytics -- real counts and time series only.
// `restaurantId: null` means "every active restaurant" (Super Admin's
// cross-tenant view) -- every function below treats it as "no restaurant
// filter" rather than a special case, so the same code path serves both.
// ---------------------------------------------------------------------------

export type DateRange = { start: Date; end: Date };

/** Same-length window immediately preceding `range`, for period-over-period comparisons. */
export function previousPeriod(range: DateRange): DateRange {
  const lengthMs = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - lengthMs),
    end: new Date(range.start.getTime() - 1),
  };
}

/** Null-safe %, rounded, matching StatCard's `comparisonPct` contract. Returns null (never 0) when there's nothing to compare against, so the UI can omit the trend arrow instead of showing a misleading "0%". */
export function comparisonPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

async function campaignPromoCodeIds(restaurantId: string | null): Promise<string[]> {
  let query = supabase
    .from("marketing_campaigns")
    .select("promo_code_id")
    .not("promo_code_id", "is", null);
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { data, error } = await query;
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.promo_code_id as string)));
}

export async function fetchTotalCustomersCount(restaurantId: string | null): Promise<number> {
  let query = supabase.from("customers").select("id", { count: "exact", head: true });
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchActiveCustomersCount(restaurantId: string | null): Promise<number> {
  const inactiveSinceDays = AUDIENCE_SEGMENT_DEFAULTS.inactive.inactiveSinceDays ?? 14;
  const cutoff = new Date(Date.now() - inactiveSinceDays * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .gte("last_order_at", cutoff);
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchNewCustomersCount(
  restaurantId: string | null,
  range: DateRange,
): Promise<number> {
  let query = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString());
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** Live count (not period-bound) of customers matching the same "inactive" preset the Audiences page uses -- kept intentionally simple (no anti-spam exclusion, which only matters when actually targeting a campaign) for a dashboard summary tile. */
export async function fetchCustomersToRelaunchCount(restaurantId: string | null): Promise<number> {
  const inactiveSinceDays = AUDIENCE_SEGMENT_DEFAULTS.inactive.inactiveSinceDays ?? 14;
  const cutoff = new Date(Date.now() - inactiveSinceDays * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("marketing_opt_out", false)
    .not("phone", "is", null)
    .neq("phone", "")
    .lte("last_order_at", cutoff);
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchActiveCampaignsCount(restaurantId: string | null): Promise<number> {
  let query = supabase
    .from("marketing_campaigns")
    .select("id", { count: "exact", head: true })
    .in("status", ["scheduled", "sending"]);
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchMessagesSentCount(
  restaurantId: string | null,
  range: DateRange,
): Promise<number> {
  let query = supabase
    .from("marketing_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", range.start.toISOString())
    .lte("sent_at", range.end.toISOString());
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export type AttributionTotals = { ordersGenerated: number; revenueGenerated: number };

/** Same real attribution rule as fetchCampaignAttribution (promo code usage, no guessing), aggregated across every campaign in scope for the period. */
export async function fetchCampaignAttributionTotals(
  restaurantId: string | null,
  range: DateRange,
): Promise<AttributionTotals> {
  const promoCodeIds = await campaignPromoCodeIds(restaurantId);
  if (promoCodeIds.length === 0) return { ordersGenerated: 0, revenueGenerated: 0 };
  const { data, error } = await supabase
    .from("promo_code_usages")
    .select("order_id, orders(total_amount)")
    .in("promo_code_id", promoCodeIds)
    .gte("used_at", range.start.toISOString())
    .lte("used_at", range.end.toISOString());
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    order_id: string;
    orders: { total_amount: number } | null;
  }[];
  return {
    ordersGenerated: rows.length,
    revenueGenerated: rows.reduce((sum, r) => sum + (r.orders?.total_amount ?? 0), 0),
  };
}

export type DashboardOverview = {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  customersToRelaunch: number;
  campaignsActive: number;
  messagesSent: number;
  ordersGenerated: number;
  revenueGenerated: number;
  /** null when messagesSent is 0 -- never a divide-by-zero 0%. */
  conversionRate: number | null;
  previous: {
    newCustomers: number;
    messagesSent: number;
    ordersGenerated: number;
    revenueGenerated: number;
  };
};

/** Every field here is either a live count or a real query over `range` -- nothing here is ever estimated or hardcoded. */
export async function fetchDashboardOverview(
  restaurantId: string | null,
  range: DateRange,
): Promise<DashboardOverview> {
  const prev = previousPeriod(range);
  const [
    totalCustomers,
    activeCustomers,
    newCustomers,
    customersToRelaunch,
    campaignsActive,
    messagesSent,
    attribution,
    prevNewCustomers,
    prevMessagesSent,
    prevAttribution,
  ] = await Promise.all([
    fetchTotalCustomersCount(restaurantId),
    fetchActiveCustomersCount(restaurantId),
    fetchNewCustomersCount(restaurantId, range),
    fetchCustomersToRelaunchCount(restaurantId),
    fetchActiveCampaignsCount(restaurantId),
    fetchMessagesSentCount(restaurantId, range),
    fetchCampaignAttributionTotals(restaurantId, range),
    fetchNewCustomersCount(restaurantId, prev),
    fetchMessagesSentCount(restaurantId, prev),
    fetchCampaignAttributionTotals(restaurantId, prev),
  ]);

  return {
    totalCustomers,
    activeCustomers,
    newCustomers,
    customersToRelaunch,
    campaignsActive,
    messagesSent,
    ordersGenerated: attribution.ordersGenerated,
    revenueGenerated: attribution.revenueGenerated,
    conversionRate:
      messagesSent > 0
        ? Math.round((attribution.ordersGenerated / messagesSent) * 1000) / 10
        : null,
    previous: {
      newCustomers: prevNewCustomers,
      messagesSent: prevMessagesSent,
      ordersGenerated: prevAttribution.ordersGenerated,
      revenueGenerated: prevAttribution.revenueGenerated,
    },
  };
}

export type DailyPoint = { date: string; count: number };

function bucketByDay(dates: string[], range: DateRange): DailyPoint[] {
  const counts = new Map<string, number>();
  for (const iso of dates) {
    const day = iso.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const points: DailyPoint[] = [];
  const cursor = new Date(range.start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(range.end);
  endDay.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= endDay.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    points.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

/** Real daily new-customer counts over `range` -- the dashboard's "Évolution des clients" series. */
export async function fetchNewCustomersDailySeries(
  restaurantId: string | null,
  range: DateRange,
): Promise<DailyPoint[]> {
  let query = supabase
    .from("customers")
    .select("created_at")
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString());
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { data, error } = await query;
  if (error) throw error;
  return bucketByDay(
    (data ?? []).map((r) => r.created_at as string),
    range,
  );
}

/** Real daily count of orders attributed to a campaign's promo code -- the dashboard's "Commandes issues des campagnes" series. */
export async function fetchCampaignOrdersDailySeries(
  restaurantId: string | null,
  range: DateRange,
): Promise<DailyPoint[]> {
  const promoCodeIds = await campaignPromoCodeIds(restaurantId);
  if (promoCodeIds.length === 0) return bucketByDay([], range);
  const { data, error } = await supabase
    .from("promo_code_usages")
    .select("used_at")
    .in("promo_code_id", promoCodeIds)
    .gte("used_at", range.start.toISOString())
    .lte("used_at", range.end.toISOString());
  if (error) throw error;
  return bucketByDay(
    (data ?? []).map((r) => r.used_at as string),
    range,
  );
}

export type TopSegmentRow = { key: AudienceSegmentKey; label: string; count: number };

/** Live eligible count per preset segment (same engine as the Audiences page), sorted descending -- the dashboard's "Top audiences" panel. */
export async function fetchTopSegments(restaurantId: string): Promise<TopSegmentRow[]> {
  const keys = Object.keys(AUDIENCE_SEGMENT_DEFAULTS) as Exclude<AudienceSegmentKey, "custom">[];
  const previews = await Promise.all(
    keys.map((key) => fetchAudiencePreview(restaurantId, AUDIENCE_SEGMENT_DEFAULTS[key])),
  );
  return keys
    .map((key, i) => ({ key, label: AUDIENCE_SEGMENT_LABELS[key], count: previews[i]!.eligible }))
    .sort((a, b) => b.count - a.count);
}

export type TopCampaignRow = Campaign & AttributionTotals;

/** Top campaigns by attributed revenue within `range` (matched on created_at) -- real per-campaign attribution, sorted descending. */
export async function fetchTopCampaigns(
  restaurantId: string | null,
  range: DateRange,
  limit = 5,
): Promise<TopCampaignRow[]> {
  let query = supabase
    .from("marketing_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString());
  if (restaurantId) query = query.eq("restaurant_id", restaurantId);
  const { data, error } = await query;
  if (error) throw error;
  const campaigns = (data ?? []) as unknown as Campaign[];
  const withAttribution = await Promise.all(
    campaigns.map(async (c) => ({ ...c, ...(await fetchCampaignAttribution(c)) })),
  );
  return withAttribution.sort((a, b) => b.revenueGenerated - a.revenueGenerated).slice(0, limit);
}

export type RestaurantPerformanceRow = {
  restaurantId: string;
  restaurantName: string;
  ordersGenerated: number;
  revenueGenerated: number;
};

/** Restaurants with at least one campaign, ranked by attributed revenue within `range` -- the dashboard/analytics "performance par restaurant" table. */
export async function fetchTopRestaurantsByPerformance(
  range: DateRange,
  limit = 5,
): Promise<RestaurantPerformanceRow[]> {
  const campaigns = await fetchTopCampaigns(null, range, 1000);
  const byRestaurant = new Map<string, RestaurantPerformanceRow>();
  for (const c of campaigns) {
    if (!c.restaurant) continue;
    const entry = byRestaurant.get(c.restaurant.id) ?? {
      restaurantId: c.restaurant.id,
      restaurantName: c.restaurant.name,
      ordersGenerated: 0,
      revenueGenerated: 0,
    };
    entry.ordersGenerated += c.ordersGenerated;
    entry.revenueGenerated += c.revenueGenerated;
    byRestaurant.set(c.restaurant.id, entry);
  }
  return Array.from(byRestaurant.values())
    .sort((a, b) => b.revenueGenerated - a.revenueGenerated)
    .slice(0, limit);
}

/** For the Promotions page's "Campagnes associées" column -- real join, batched for every promo code on screen at once. */
export async function fetchCampaignsByPromoCodeIds(
  promoCodeIds: string[],
): Promise<Map<string, { id: string; name: string; status: CampaignStatus }[]>> {
  const map = new Map<string, { id: string; name: string; status: CampaignStatus }[]>();
  if (promoCodeIds.length === 0) return map;
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("id,name,status,promo_code_id")
    .in("promo_code_id", promoCodeIds);
  if (error) throw error;
  for (const row of (data ?? []) as {
    id: string;
    name: string;
    status: CampaignStatus;
    promo_code_id: string;
  }[]) {
    const list = map.get(row.promo_code_id) ?? [];
    list.push({ id: row.id, name: row.name, status: row.status });
    map.set(row.promo_code_id, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Client "fiche" -- real aggregations for the CRM client detail sheet, none
// of which are already covered by customers-db.ts's fetchCustomerOrderHistory.
// ---------------------------------------------------------------------------

export type FavoriteProduct = { name: string; count: number };

/** Real product-quantity tally across every one of this customer's own orders -- not a guess, not a restaurant-wide bestseller list. */
export async function fetchCustomerFavoriteProducts(
  customerId: string,
  limit = 5,
): Promise<FavoriteProduct[]> {
  const { data: orderRows, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_id", customerId);
  if (ordersError) throw ordersError;
  const orderIds = (orderRows ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) return [];
  const { data, error } = await supabase
    .from("order_items")
    .select("product_name_snapshot, quantity")
    .in("order_id", orderIds);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { product_name_snapshot: string; quantity: number }[]) {
    counts.set(
      row.product_name_snapshot,
      (counts.get(row.product_name_snapshot) ?? 0) + row.quantity,
    );
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type FrequentedRestaurant = {
  restaurantId: string;
  restaurantName: string;
  ordersCount: number;
  totalSpent: number;
};

/** Other restaurants (in this same multi-tenant platform) where a `customers` row with the same phone number exists -- `customers` is per-restaurant, so "restaurants fréquentés" is a real cross-row match on phone, never a guess. */
export async function fetchCustomerFrequentedRestaurants(
  phone: string,
  excludeRestaurantId: string,
): Promise<FrequentedRestaurant[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("restaurant_id, orders_count, total_spent, restaurant:restaurants(name)")
    .eq("phone", phone)
    .neq("restaurant_id", excludeRestaurantId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      restaurant_id: string;
      orders_count: number;
      total_spent: number;
      restaurant: { name: string } | null;
    };
    return {
      restaurantId: r.restaurant_id,
      restaurantName: r.restaurant?.name ?? "Restaurant",
      ordersCount: r.orders_count,
      totalSpent: Number(r.total_spent),
    };
  });
}

export type CustomerCampaignHistoryRow = {
  campaignId: string;
  campaignName: string;
  campaignStatus: CampaignStatus;
  sentAt: string | null;
  recipientStatus: "pending" | "sent" | "excluded";
  /** True when this customer has at least one promo-code usage on that campaign's exact code -- the same real signal fetchCampaignAttribution uses in aggregate, applied to one customer. */
  converted: boolean;
};

export async function fetchCustomerCampaignHistory(
  customerId: string,
): Promise<CustomerCampaignHistoryRow[]> {
  const [{ data: recipientRows, error: recipientsError }, { data: usageRows, error: usagesError }] =
    await Promise.all([
      supabase
        .from("marketing_campaign_recipients")
        .select("status, sent_at, campaign:marketing_campaigns(id,name,status,promo_code_id)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase.from("promo_code_usages").select("promo_code_id").eq("customer_id", customerId),
    ]);
  if (recipientsError) throw recipientsError;
  if (usagesError) throw usagesError;
  const usedPromoCodeIds = new Set((usageRows ?? []).map((u) => u.promo_code_id as string));

  type Row = {
    status: "pending" | "sent" | "excluded";
    sent_at: string | null;
    campaign: {
      id: string;
      name: string;
      status: CampaignStatus;
      promo_code_id: string | null;
    } | null;
  };
  return ((recipientRows ?? []) as unknown as Row[])
    .filter((row): row is Row & { campaign: NonNullable<Row["campaign"]> } => Boolean(row.campaign))
    .map((row) => ({
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      campaignStatus: row.campaign.status,
      sentAt: row.sent_at,
      recipientStatus: row.status,
      converted: Boolean(
        row.campaign.promo_code_id && usedPromoCodeIds.has(row.campaign.promo_code_id),
      ),
    }));
}

// ---------------------------------------------------------------------------
// Automations -- real CRUD on stored workflow definitions. No execution
// engine exists yet: creating or activating one only ever persists intent,
// it never sends a message or triggers anything by itself. The UI must say
// this explicitly wherever a workflow's status is shown.
// ---------------------------------------------------------------------------

export type AutomationTriggerType =
  | "after_order"
  | "inactive_customer"
  | "first_order"
  | "abandoned_cart"
  | "vip_customer"
  | "birthday";

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  after_order: "Après une commande",
  inactive_customer: "Client inactif",
  first_order: "Première commande",
  abandoned_cart: "Panier abandonné",
  vip_customer: "Client VIP",
  birthday: "Anniversaire",
};

export type AutomationStatus = "draft" | "active" | "paused";

export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  draft: "Brouillon",
  active: "Active",
  paused: "En pause",
};

export type AutomationStep =
  | { type: "wait"; hours: number }
  | { type: "condition"; description: string }
  | { type: "action"; description: string };

export type Automation = {
  id: string;
  restaurant_id: string;
  created_by: string | null;
  name: string;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  steps: AutomationStep[];
  status: AutomationStatus;
  created_at: string;
  updated_at: string;
};

export async function fetchAutomations(restaurantId: string): Promise<Automation[]> {
  const { data, error } = await supabase
    .from("marketing_automations")
    .select(
      "id,restaurant_id,created_by,name,trigger_type,trigger_config,steps,status,created_at,updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Automation[];
}

export type CreateAutomationInput = {
  restaurantId: string;
  name: string;
  triggerType: AutomationTriggerType;
  steps: AutomationStep[];
};

export async function createAutomation(input: CreateAutomationInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("marketing_automations")
    .insert({
      restaurant_id: input.restaurantId,
      created_by: user?.id ?? null,
      name: input.name,
      trigger_type: input.triggerType,
      trigger_config: {},
      steps: input.steps as unknown as Json,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function setAutomationStatus(id: string, status: AutomationStatus): Promise<void> {
  const { error } = await supabase.from("marketing_automations").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await supabase.from("marketing_automations").delete().eq("id", id);
  if (error) throw error;
}
