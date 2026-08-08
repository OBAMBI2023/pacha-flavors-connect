import { MapPin, Navigation, Phone, MessageCircle } from "lucide-react";
import { SITE, mapsDirectionsUrl, mapsEmbedUrl, whatsappUrl } from "@/data/site";

export function ContactSection() {
  return (
    <section id="contact" className="section-pad bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">
            Nous trouver
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Contact</h2>

          <div className="mt-8 space-y-4 text-sm">
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <address className="not-italic leading-relaxed">
                <strong className="font-display text-lg font-semibold">{SITE.fullName}</strong>
                <br />
                {SITE.address.line1}
                <br />
                {SITE.address.line2}
                <br />
                {SITE.address.city}
              </address>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 shrink-0 text-primary" />
              <a href={`tel:${SITE.phoneTel}`} className="font-medium hover:text-primary">
                {SITE.phoneDisplay}
              </a>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`tel:${SITE.phoneTel}`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Phone className="h-4 w-4" /> Appeler
            </a>
            <a
              href={whatsappUrl("Bonjour LE PACHA")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a
              href={mapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              <Navigation className="h-4 w-4" /> Itinéraire
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <iframe
            title="Localisation de Le Pacha Restaurant à Angré 8e Tranche"
            src={mapsEmbedUrl}
            loading="lazy"
            className="h-80 w-full lg:h-full"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}