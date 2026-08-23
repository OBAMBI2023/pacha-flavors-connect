const SAOVIA_WHATSAPP_MESSAGE =
  "Bonjour Saovia Technologies, je souhaite obtenir des informations concernant la plateforme.";

const SAOVIA_WHATSAPP_URL = `https://wa.me/2250758483726?text=${encodeURIComponent(
  SAOVIA_WHATSAPP_MESSAGE,
)}`;

type PublicFooterProps = {
  restaurantName?: string;
};

export function PublicFooter({ restaurantName }: PublicFooterProps) {
  return (
    <footer className="bg-cocoa px-4 py-5 text-cocoa-foreground sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 text-center text-xs">
        <span className="text-cocoa-foreground/60">
          © {new Date().getFullYear()} {restaurantName ?? ""}
        </span>
        <a
          href={SAOVIA_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-cocoa-foreground/75 transition-colors hover:text-cocoa-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocoa-foreground/70 focus-visible:ring-offset-2 focus-visible:ring-offset-cocoa"
        >
          Saovia Technologies
        </a>
      </div>
    </footer>
  );
}
