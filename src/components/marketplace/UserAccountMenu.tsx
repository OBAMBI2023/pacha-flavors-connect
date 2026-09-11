import { Link } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase-any";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserAccountMenu({ restaurantId }: { restaurantId: string }) {
  const { canManageMenu, restaurantId: userRestaurantId } = useAuth();
  const isAuthorized = canManageMenu && restaurantId === userRestaurantId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary">
        <User className="h-4 w-4" />
        Compte
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAuthorized && (
          <DropdownMenuItem asChild>
            <Link to="/admin" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Gérer mon établissement
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => supabase.auth.signOut()} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
