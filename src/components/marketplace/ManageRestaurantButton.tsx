import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ManageRestaurantButton({ restaurantId }: { restaurantId: string }) {
  const { restaurantId: userRestaurantId, canManageMenu } = useAuth();

  // Securely check if the user is authorized for the specific restaurant
  if (!canManageMenu || restaurantId !== userRestaurantId) {
    return null;
  }

  return (
    <Link
      to="/admin"
      className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
    >
      <Settings className="h-4 w-4" />
      Gérer mon établissement
    </Link>
  );
}
