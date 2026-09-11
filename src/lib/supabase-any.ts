import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as typedSupabase } from "@/integrations/supabase/client";

// The generated Database types only describe the tables of the locally
// connected backend instance, while the app targets the full production
// schema (orders, restaurants, drivers, ...). Re-export the same client
// instance without the generated Database generic so data-access modules
// are not blocked by the stale generated types. Runtime behavior is
// identical — this is a type-level alias only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typedSupabase as unknown as SupabaseClient<any>;
