export const SITE = {
  name: "LE PACHA",
  fullName: "LE PACHA RESTAURANT",
  address: {
    line1: "Angré 8e Tranche",
    line2: "Feu du SICOMEX",
    city: "Abidjan, Côte d'Ivoire",
  },
  phoneDisplay: "+225 07 07 17 05 14",
  phoneTel: "+2250707170514",
  whatsapp: "2250707170514",
  mapsQuery: "Angré 8e Tranche, Feu du SICOMEX, Abidjan, Côte d'Ivoire",
} as const;

export const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  SITE.mapsQuery,
)}`;

export const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
  SITE.mapsQuery,
)}&output=embed`;

export function whatsappUrl(message: string) {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}