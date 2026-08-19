import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES = ["trial", "active", "suspended", "archived"] as const;
const ROLES = ["owner", "manager", "staff"] as const;
const MEMBER_STATUSES = ["active", "invited", "disabled"] as const;

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  address: string | null;
  commune: string | null;
  city: string | null;
  status: (typeof STATUSES)[number];
  trial_ends_at: string | null;
  is_public: boolean;
  created_at: string;
};

type Membership = {
  id: string;
  user_id: string;
  restaurant_id: string;
  role: (typeof ROLES)[number];
  status: (typeof MEMBER_STATUSES)[number] | null;
  email: string | null;
};
type MemberRow = {
  user_id: string;
  restaurant_id: string;
  role: (typeof ROLES)[number];
  status: (typeof MEMBER_STATUSES)[number] | null;
  email: string | null;
};

export const Route = createFileRoute("/super-admin/restaurants/$restaurantId")({
  ssr: false,
  component: RestaurantDetailPage,
});

function RestaurantDetailPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { restaurantId } = Route.useParams();
  const [allowed, setAllowed] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<(typeof ROLES)[number]>("manager");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, navigate, user]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("id,is_super_admin,email").eq("id", user.id).maybeSingle();
      if (!profile?.is_super_admin) {
        if (!cancelled) setAllowed(false);
        return;
      }
      const [{ data: restaurantData }, { data: membershipData }] = await Promise.all([
        supabase.from("restaurants").select("id,name,slug,phone,whatsapp_phone,email,address,commune,city,status,trial_ends_at,is_public,created_at").eq("id", restaurantId).maybeSingle(),
        supabase.rpc("super_admin_list_restaurant_members", { restaurant_id: restaurantId }),
      ]);
      if (cancelled) return;
      setAllowed(true);
      setRestaurant((restaurantData as Restaurant | null) ?? null);
      setMembers(
        (membershipData ?? []).map((item) => ({
          id: `${item.user_id}:${item.role}`,
          user_id: item.user_id,
          restaurant_id: item.restaurant_id,
          role: item.role,
          status: item.status,
          email: item.email,
        })),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, user]);

  if (loading) return <p className="p-10 text-sm text-muted-foreground">Chargement...</p>;
  if (!user) return null;
  if (!allowed) return null;
  if (!restaurant) return <main className="p-10 text-sm text-muted-foreground">Restaurant introuvable.</main>;

  async function saveRestaurant(patch: Partial<Pick<Restaurant, "status" | "is_public">>) {
    const { error } = await supabase.from("restaurants").update(patch).eq("id", restaurant.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Restaurant mis a jour");
      setRestaurant({ ...restaurant, ...patch });
    }
  }

  async function addMember() {
    const email = memberEmail.trim();
    if (!email) return;
    const { error } = await supabase.rpc("super_admin_add_restaurant_member", {
      _restaurant_id: restaurant.id,
      _email: email,
      _role: memberRole,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Membre ajoute");
    setMemberEmail("");
    const { data } = await supabase.rpc("super_admin_list_restaurant_members", { _restaurant_id: restaurant.id });
    setMembers(
      (data ?? []).map((item) => ({
        id: `${item.user_id}:${item.role}`,
        user_id: item.user_id,
        restaurant_id: item.restaurant_id,
        role: item.role,
        status: item.status,
        email: item.email,
      })),
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">Restaurant</p>
            <h1 className="mt-2 text-3xl font-semibold">{restaurant.name}</h1>
            <p className="mt-2 text-sm text-slate-300">{restaurant.slug}</p>
          </div>
          <Link to="/super-admin" className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100">Retour</Link>
        </div>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Informations</p>
            <p className="text-sm text-slate-300">Email: {restaurant.email ?? "-"}</p>
            <p className="text-sm text-slate-300">Phone: {restaurant.phone ?? "-"}</p>
            <p className="text-sm text-slate-300">WhatsApp: {restaurant.whatsapp_phone ?? "-"}</p>
            <p className="text-sm text-slate-300">Adresse: {restaurant.address ?? "-"}</p>
            <p className="text-sm text-slate-300">Commune: {restaurant.commune ?? "-"}</p>
            <p className="text-sm text-slate-300">Ville: {restaurant.city ?? "-"}</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-200">Status</Label>
              <select value={restaurant.status} onChange={(e) => void saveRestaurant({ status: e.target.value as Restaurant["status"] })} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
              <input type="checkbox" checked={restaurant.is_public} onChange={(e) => void saveRestaurant({ is_public: e.target.checked })} />
              <span className="text-sm">Visible au public</span>
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Membres</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-3 py-2">user_id</th>
                  <th className="px-3 py-2">role</th>
                  <th className="px-3 py-2">status</th>
                  <th className="px-3 py-2">email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {members.map((member) => {
                  return (
                    <tr key={member.id}>
                      <td className="px-3 py-3 font-mono text-xs">{member.user_id}</td>
                      <td className="px-3 py-3">{member.role}</td>
                      <td className="px-3 py-3">{member.status ?? "-"}</td>
                      <td className="px-3 py-3">{member.email ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Ajouter un membre</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
            <div className="space-y-2">
              <Label>Email de l&apos;utilisateur</Label>
              <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} className="bg-slate-900 text-slate-100" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as typeof memberRole)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm">
                {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
            <div className="flex items-end md:col-span-2">
              <Button onClick={addMember} className="w-full">Ajouter</Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
