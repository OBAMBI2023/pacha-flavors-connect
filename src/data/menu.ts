import tchep from "@/assets/tchep.jpg";
import alloco from "@/assets/alloco.jpg";
import placali from "@/assets/placali.jpg";
import foutou from "@/assets/foutou.jpg";
import grillades from "@/assets/grillades.jpg";
import poisson from "@/assets/poisson.jpg";
import poulet from "@/assets/poulet.jpg";

export type Category = string;

/** Images livrées avec le site, utilisées tant qu'aucune photo n'a été téléversée. */
export const FALLBACK_IMAGES: Record<string, string> = {
  tchep,
  "alloco-poulet-poisson": alloco,
  "placali-kope": placali,
  "foutou-graine": foutou,
  "poulet-braise": poulet,
  "poisson-braise": poisson,
  brochettes: grillades,
  "alloco-simple": alloco,
};

export type MenuItem = {
  id: string;
  name: string;
  subtitle?: string | undefined;
  description: string;
  /** null = prix non communiqué -> « Prix sur demande » */
  price: number | null;
  image?: string | undefined;
  category: Category;
  available: boolean;
  daily?: boolean | undefined;
};

export const CATEGORIES: { id: Category | "tous"; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "plats", label: "Plats" },
  { id: "poulet", label: "Poulet" },
  { id: "poisson", label: "Poisson" },
  { id: "grillades", label: "Grillades" },
  { id: "accompagnements", label: "Accompagnements" },
  { id: "boissons", label: "Boissons" },
  { id: "desserts", label: "Desserts" },
];

export const MENU: MenuItem[] = [
  {
    id: "tchep",
    name: "Tchep",
    subtitle: "Poisson & poulet",
    description:
      "Riz parfumé mijoté aux légumes frais, poisson et poulet tendres, épices locales.",
    price: null,
    image: tchep,
    category: "plats",
    available: true,
    daily: true,
  },
  {
    id: "alloco-poulet-poisson",
    name: "Alloco",
    subtitle: "Poulet et poisson",
    description:
      "Bananes plantains dorées, servies avec poulet et poisson, sauce oignons épicée.",
    price: null,
    image: alloco,
    category: "plats",
    available: true,
    daily: true,
  },
  {
    id: "placali-kope",
    name: "Placali",
    subtitle: "Sauce kopè graine",
    description: "Placali généreux accompagné d'une sauce kopè graine riche et parfumée.",
    price: null,
    image: placali,
    category: "plats",
    available: true,
    daily: true,
  },
  {
    id: "foutou-graine",
    name: "Foutou",
    subtitle: "Sauce graine",
    description: "Foutou traditionnel servi avec une sauce graine mijotée longuement.",
    price: null,
    image: foutou,
    category: "plats",
    available: true,
    daily: true,
  },
  {
    id: "poulet-braise",
    name: "Poulet braisé",
    subtitle: "Accompagnement au choix",
    description: "Poulet mariné aux épices, braisé lentement, servi avec l'accompagnement de votre choix.",
    price: null,
    image: poulet,
    category: "poulet",
    available: true,
  },
  {
    id: "poisson-braise",
    name: "Poisson braisé",
    subtitle: "Sauce oignons",
    description: "Poisson frais braisé, sauce oignons maison et attiéké ou alloco.",
    price: null,
    image: poisson,
    category: "poisson",
    available: true,
  },
  {
    id: "brochettes",
    name: "Brochettes grillées",
    subtitle: "Au feu de bois",
    description: "Brochettes marinées et grillées au charbon, servies avec sauce piquante.",
    price: null,
    image: grillades,
    category: "grillades",
    available: true,
  },
  {
    id: "attieke",
    name: "Attiéké",
    description: "Semoule de manioc fraîche, en accompagnement.",
    price: null,
    category: "accompagnements",
    available: true,
  },
  {
    id: "alloco-simple",
    name: "Alloco nature",
    description: "Bananes plantains frites, croustillantes et fondantes.",
    price: null,
    image: alloco,
    category: "accompagnements",
    available: true,
  },
  {
    id: "riz-blanc",
    name: "Riz blanc",
    description: "Riz blanc parfumé, en accompagnement.",
    price: null,
    category: "accompagnements",
    available: true,
  },
  {
    id: "eau",
    name: "Eau minérale",
    description: "Bouteille d'eau fraîche.",
    price: null,
    category: "boissons",
    available: true,
  },
  {
    id: "jus-bissap",
    name: "Jus local",
    subtitle: "Bissap / gingembre",
    description: "Jus naturel préparé maison, servi bien frais.",
    price: null,
    category: "boissons",
    available: true,
  },
  {
    id: "soda",
    name: "Sodas",
    description: "Boissons gazeuses au choix.",
    price: null,
    category: "boissons",
    available: true,
  },
  {
    id: "dessert-fruits",
    name: "Assiette de fruits frais",
    description: "Sélection de fruits de saison découpés.",
    price: null,
    category: "desserts",
    available: true,
  },
];

export const DAILY_MENU = MENU.filter((item) => item.daily);

export function formatPrice(price: number | null) {
  return price === null ? "Prix sur demande" : `${price.toLocaleString("fr-FR")} FCFA`;
}