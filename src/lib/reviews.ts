import { supabase } from "@/lib/supabase-any";

export type ReviewStatus = "published" | "hidden";
export type ReportReason = "spam" | "harassment" | "offensive_content" | "false_review" | "inappropriate_content" | "other";
export type ReportStatus = "pending" | "under_review" | "resolved" | "dismissed";

export type ReviewReply = { message: string; created_at: string };

export type OrderReview = {
  id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  status: ReviewStatus;
  created_at: string;
  reply: ReviewReply | null;
};

// ---------------------------------------------------------------------------
// Client-facing (guest, phone-verified -- same ownership convention as
// fetchCustomerOrder in orders.ts)
// ---------------------------------------------------------------------------

export async function submitReview(params: {
  orderId: string;
  customerPhone: string;
  rating: number;
  comment?: string | null;
  photos?: string[];
  visitorId?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("submit_review", {
    p_order_id: params.orderId,
    p_customer_phone: params.customerPhone,
    p_rating: params.rating,
    p_comment: params.comment ?? null,
    p_photos: params.photos ?? [],
    p_visitor_id: params.visitorId ?? null,
  });
  if (error) throw error;
  return (data as { review_id: string }).review_id;
}

export async function updateReview(params: {
  reviewId: string;
  customerPhone: string;
  rating: number;
  comment?: string | null;
  photos?: string[];
}): Promise<void> {
  const { error } = await supabase.rpc("update_review", {
    p_review_id: params.reviewId,
    p_customer_phone: params.customerPhone,
    p_rating: params.rating,
    p_comment: params.comment ?? null,
    p_photos: params.photos ?? [],
  });
  if (error) throw error;
}

export async function fetchOrderReview(orderId: string, customerPhone: string): Promise<OrderReview | null> {
  const { data, error } = await supabase.rpc("get_order_review", { p_order_id: orderId, p_customer_phone: customerPhone });
  if (error) throw error;
  return (data as unknown as OrderReview | null) ?? null;
}

export async function reportReview(params: { reviewId: string; reason: ReportReason; description?: string | null; visitorId?: string | null }): Promise<void> {
  const { error } = await supabase.rpc("report_review", {
    p_review_id: params.reviewId,
    p_reason: params.reason,
    p_description: params.description ?? null,
    p_visitor_id: params.visitorId ?? null,
  });
  if (error) throw error;
}

export type TenantReview = {
  id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  photos: string[];
  created_at: string;
  reply: ReviewReply | null;
};

export async function fetchPublicTenantReviews(slug: string, limit = 20): Promise<TenantReview[]> {
  const { data, error } = await supabase.rpc("get_tenant_reviews", { p_slug: slug, p_limit: limit });
  if (error) throw error;
  return (data as unknown as TenantReview[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Tenant admin (direct table access via RLS -- same pattern as offers/
// customers admin CRUD; only the cross-cutting stats are an RPC)
// ---------------------------------------------------------------------------

export type AdminReview = {
  id: string;
  order_id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  photos: string[];
  status: ReviewStatus;
  created_at: string;
  order: { order_number: number } | null;
  reply: { id: string; message: string; created_at: string } | null;
  report_count: number;
};

export type ReviewsStats = {
  total_reviews: number;
  average_rating: number;
  five_star_reviews: number;
  four_star_reviews: number;
  three_star_reviews: number;
  two_star_reviews: number;
  one_star_reviews: number;
  unanswered_reviews: number;
  reported_reviews: number;
};

export async function fetchReviewsStats(): Promise<ReviewsStats> {
  const { data, error } = await supabase.rpc("get_reviews_stats");
  if (error) throw error;
  return data as unknown as ReviewsStats;
}

export async function fetchAdminReviews(restaurantId: string): Promise<AdminReview[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id,order_id,customer_name,rating,comment,photos,status,created_at,orders(order_number),review_replies(id,message,created_at),review_reports(status)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    order_id: row.order_id,
    customer_name: row.customer_name,
    rating: row.rating,
    comment: row.comment,
    photos: row.photos ?? [],
    status: row.status,
    created_at: row.created_at,
    order: row.orders ? { order_number: row.orders.order_number } : null,
    reply: row.review_replies?.[0] ?? null,
    report_count: (row.review_reports ?? []).filter((r: { status: string }) => r.status === "pending" || r.status === "under_review").length,
  }));
}

/** Upserts by review_id (one reply per review, editable in place). */
export async function upsertReviewReply(reviewId: string, restaurantId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from("review_replies")
    .upsert({ review_id: reviewId, restaurant_id: restaurantId, message }, { onConflict: "review_id" });
  if (error) throw error;
}

export async function hideReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from("reviews").update({ status: "hidden" }).eq("id", reviewId);
  if (error) throw error;
}

export async function reportReviewAsTenant(reviewId: string, restaurantId: string, reason: ReportReason, description?: string | null): Promise<void> {
  const { error } = await supabase.from("review_reports").insert({
    review_id: reviewId,
    restaurant_id: restaurantId,
    reporter_type: "tenant",
    reason,
    description: description ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Super-admin (direct table access via RLS is_super_admin policies)
// ---------------------------------------------------------------------------

export type AdminReviewReport = {
  id: string;
  review_id: string;
  restaurant_id: string;
  reporter_type: "customer" | "tenant";
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  restaurant: { name: string } | null;
  review: { customer_name: string; rating: number; comment: string | null; status: ReviewStatus } | null;
};

export async function fetchReviewReports(): Promise<AdminReviewReport[]> {
  const { data, error } = await supabase
    .from("review_reports")
    .select("id,review_id,restaurant_id,reporter_type,reason,description,status,created_at,resolved_at,restaurants(name),reviews(customer_name,rating,comment,status)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    review_id: row.review_id,
    restaurant_id: row.restaurant_id,
    reporter_type: row.reporter_type,
    reason: row.reason,
    description: row.description,
    status: row.status,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    restaurant: row.restaurants ? { name: row.restaurants.name } : null,
    review: row.reviews ?? null,
  }));
}

export async function setReviewReportStatus(reportId: string, status: ReportStatus): Promise<void> {
  const { error } = await supabase.from("review_reports").update({ status }).eq("id", reportId);
  if (error) throw error;
}

export async function setReviewVisibility(reviewId: string, status: ReviewStatus): Promise<void> {
  const { error } = await supabase.from("reviews").update({ status }).eq("id", reviewId);
  if (error) throw error;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Harcèlement",
  offensive_content: "Contenu offensant",
  false_review: "Faux avis",
  inappropriate_content: "Contenu inapproprié",
  other: "Autre",
};
