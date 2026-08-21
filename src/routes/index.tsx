import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CartProvider } from "@/lib/cart";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { DailyMenu } from "@/components/DailyMenu";
import { MenuCategories } from "@/components/MenuCategories";
import { DeliverySection } from "@/components/DeliverySection";
import { ReservationSection } from "@/components/ReservationSection";
import { AboutSection } from "@/components/AboutSection";
import { ContactSection } from "@/components/ContactSection";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { StickyCartBar } from "@/components/StickyCartBar";
import { MoreSheet } from "@/components/MoreSheet";
import { MenuSearchSheet } from "@/components/MenuSearchSheet";
import { CategoriesSheet } from "@/components/CategoriesSheet";

const TITLE = "Le Pacha Restaurant | Restaurant à Angré 8e Tranche Abidjan";
const DESCRIPTION =
  "Découvrez Le Pacha Restaurant à Angré 8e Tranche, Abidjan. Cuisine authentique, plats africains, réservation, commande à emporter et livraison.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "restaurant Angré, restaurant Angré 8e Tranche, restaurant Abidjan, restaurant SICOMEX, livraison repas Angré, restaurant cuisine africaine Abidjan, restaurant ivoirien Abidjan",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "restaurant" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Restaurant",
          name: "Le Pacha Restaurant",
          servesCuisine: ["Ivoirienne", "Africaine"],
          telephone: "+2250707170514",
          address: {
            "@type": "PostalAddress",
            streetAddress: "Angré 8e Tranche, Feu du SICOMEX",
            addressLocality: "Abidjan",
            addressCountry: "CI",
          },
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("tous");

  return (
    <CartProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pb-24 lg:pb-0">
          <Hero />
          <DailyMenu slug="le-pacha" />
          <MenuCategories
            slug="le-pacha"
            activeCategory={activeCategory}
            onActiveCategoryChange={setActiveCategory}
            onOpenCategories={() => setCategoriesOpen(true)}
          />
          <DeliverySection />
          <ReservationSection />
          <AboutSection />
          <ContactSection />
        </main>
        <Footer />
        <CartDrawer />
        <StickyCartBar />
        <MobileBottomNav
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMore={() => setMoreOpen(true)}
          isSearchOpen={searchOpen}
          isMoreOpen={moreOpen}
        />
        <MenuSearchSheet slug="le-pacha" open={searchOpen} onOpenChange={setSearchOpen} />
        <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
        <CategoriesSheet
          slug="le-pacha"
          open={categoriesOpen}
          onOpenChange={setCategoriesOpen}
          onSelectCategory={setActiveCategory}
        />
      </div>
    </CartProvider>
  );
}
