import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const TITLE = "SAOVIA Delivery";

export const Route = createFileRoute("/deliver")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: DeliveryLanding,
});

function DeliveryLanding() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 px-4 py-16 text-center">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">SAOVIA Delivery</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Livraison express &amp; programmée</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Créez votre compte et demandez une livraison en quelques minutes -- collecte immédiate ou programmée le lendemain.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button asChild className="h-12">
          <Link to="/delivery/signup">Créer un compte</Link>
        </Button>
        <Button asChild variant="outline" className="h-12">
          <Link to="/delivery/login">Se connecter</Link>
        </Button>
      </div>
    </main>
  );
}
