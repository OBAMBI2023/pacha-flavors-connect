import { createFileRoute } from "@tanstack/react-router";
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
import { MobileActionBar } from "@/components/MobileActionBar";

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
  return (
    <CartProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <Hero />
          <DailyMenu slug="le-pacha" />
          <MenuCategories slug="le-pacha" />
          <DeliverySection />
          <ReservationSection />
          <AboutSection />
          <ContactSection />
        </main>
        <Footer />
        <CartDrawer />
        <MobileActionBar />
      </div>
    </CartProvider>
  );
}
