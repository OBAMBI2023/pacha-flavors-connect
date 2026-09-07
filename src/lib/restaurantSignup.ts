import { supabase } from "@/integrations/supabase/client";

export type SignupRestaurantResult = { restaurant_id: string; slug: string };

/**
 * Creates a brand-new restaurant + owner membership in one atomic call (see
 * supabase/migrations/20260905120000_signup_restaurant.sql). Caller must
 * already have a live Supabase Auth session (auth.signUp/signInWithPassword
 * done client-side first) -- this never accepts an existing restaurant id,
 * so it can never attach the caller to LE PACHA RESTAURANT or any other
 * existing tenant. Always creates and returns a fresh, isolated restaurant.
 */
export async function signupRestaurant(params: {
  restaurantName: string;
  fullName: string;
  phone: string;
  email: string;
}): Promise<SignupRestaurantResult> {
  const { data, error } = await supabase.rpc("signup_restaurant", {
    p_name: params.restaurantName,
    p_full_name: params.fullName,
    p_phone: params.phone,
    p_email: params.email,
  });
  if (error) throw error;
  return data as unknown as SignupRestaurantResult;
}

/** Whether this user already owns/manages at least one restaurant -- used to skip re-running signupRestaurant on a later login. */
export async function hasAnyRestaurantMembership(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("restaurant_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
