import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

const CUSTOMER_PHONE_KEY = "saovia.customer.phone";
const CUSTOMER_RESTAURANT_SLUG_KEY = "saovia.restaurant.slug";

/**
 * Shared "Mes commandes" access logic -- used by both the header's account
 * icon and the bottom nav's Compte tab, so both entry points behave
 * identically: a returning customer (phone already stored for this tenant)
 * goes straight to /commandes, a new one gets a lookup modal instead of an
 * empty "no orders" page.
 */
export function useAccountAccess(restaurantSlug: string) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  function openAccount() {
    const storedPhone = window.localStorage.getItem(CUSTOMER_PHONE_KEY);
    const storedSlug = window.localStorage.getItem(CUSTOMER_RESTAURANT_SLUG_KEY);
    if (storedPhone && storedSlug === restaurantSlug) {
      navigate({ to: "/commandes" });
    } else {
      setModalOpen(true);
    }
  }

  function submitPhone(phone: string) {
    window.localStorage.setItem(CUSTOMER_PHONE_KEY, phone);
    window.localStorage.setItem(CUSTOMER_RESTAURANT_SLUG_KEY, restaurantSlug);
    setModalOpen(false);
    navigate({ to: "/commandes" });
  }

  return { modalOpen, openAccount, closeModal: () => setModalOpen(false), submitPhone };
}
