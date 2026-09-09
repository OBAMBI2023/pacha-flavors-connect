import { Megaphone, Settings, Smartphone, TrendingUp } from "lucide-react";
import heroImmersiveImage from "@/assets/saovia-food-hero-immersive.jpg";
import menuDigitalShowcaseImage from "@/assets/saovia-food-menu-digital-showcase.png";
import grillades from "@/assets/grillades.jpg";
import poulet from "@/assets/poulet.jpg";
import poisson from "@/assets/poisson.jpg";
import alloco from "@/assets/alloco.jpg";
import placali from "@/assets/placali.jpg";
import foutou from "@/assets/foutou.jpg";
import heroPlatter from "@/assets/hero.jpg";
import saoviaAppShowcase from "@/assets/saovia-food-hero-visual.jpg";

/**
 * Single source of truth for /food/conseils content: the listing page
 * (src/routes/food_.conseils.tsx) and each article page
 * (src/routes/food_.conseils_.$slug.tsx) both import from here, so a slug or
 * a piece of copy is never duplicated between the two. To add an article,
 * append to CONSEIL_ARTICLES with a categorySlug that already exists in
 * CONSEIL_CATEGORIES (or add a new category first, picking one of the
 * existing tint tokens or adding a new one to CATEGORY_TINTS) -- both the
 * listing card and the article page pick up the new entry automatically.
 *
 * scripts/generate-seo-files.mjs also lists every article slug (that plain
 * Node script can't import this .ts file -- see its own header comment) --
 * a new slug added here must be mirrored there too so it appears in
 * dist/client/sitemap-food.xml.
 */

export type CategoryTint = "peach" | "blue" | "green" | "purple";

export const CATEGORY_TINTS: Record<
  CategoryTint,
  { bg: string; iconBg: string; iconText: string; pillBg: string; pillText: string }
> = {
  peach: {
    bg: "bg-[#FFF3EC] border-[#FFDFC9]",
    iconBg: "bg-[#FFE4D3]",
    iconText: "text-primary",
    pillBg: "bg-[#FFE4D3]",
    pillText: "text-primary",
  },
  blue: {
    bg: "bg-[#EEF4FF] border-[#D9E6FF]",
    iconBg: "bg-[#DCE9FF]",
    iconText: "text-blue-600",
    pillBg: "bg-[#DCE9FF]",
    pillText: "text-blue-700",
  },
  green: {
    bg: "bg-[#EFFBF3] border-[#D6F3E1]",
    iconBg: "bg-[#D6F3E1]",
    iconText: "text-emerald-600",
    pillBg: "bg-[#D6F3E1]",
    pillText: "text-emerald-700",
  },
  purple: {
    bg: "bg-[#F4F1FE] border-[#E4DCFB]",
    iconBg: "bg-[#E7DFFC]",
    iconText: "text-violet-600",
    pillBg: "bg-[#E7DFFC]",
    pillText: "text-violet-700",
  },
};

export type ConseilCategory = {
  slug: string;
  title: string;
  description: string;
  icon: typeof TrendingUp;
  tint: CategoryTint;
};

export const CONSEIL_CATEGORIES: ConseilCategory[] = [
  {
    slug: "developper-son-restaurant",
    title: "Développer son restaurant",
    description: "Acquisition clients, fidélisation, expérience client et croissance.",
    icon: TrendingUp,
    tint: "peach",
  },
  {
    slug: "digitaliser-son-restaurant",
    title: "Digitaliser son restaurant",
    description: "Menu digital, QR Code, commandes en ligne et outils numériques.",
    icon: Smartphone,
    tint: "blue",
  },
  {
    slug: "marketing-visibilite",
    title: "Marketing & visibilité",
    description: "Meta Ads, réseaux sociaux, référencement et stratégies marketing.",
    icon: Megaphone,
    tint: "green",
  },
  {
    slug: "gestion-operations",
    title: "Gestion & opérations",
    description: "Livraisons, clients, promotions, statistiques et organisation.",
    icon: Settings,
    tint: "purple",
  },
];

export function getCategory(slug: string): ConseilCategory {
  const category = CONSEIL_CATEGORIES.find((c) => c.slug === slug);
  if (!category) throw new Error(`Unknown conseils category slug: ${slug}`);
  return category;
}

export type ConseilContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  /** A single inline CTA-style link rendered between content blocks --
   * internal (e.g. "/food#tarifs", "/food/conseils/menu-digital-restaurant")
   * or external. Kept as plain {text, href} data rather than raw HTML/
   * markdown inside a paragraph string, so there's nothing to sanitize and
   * every destination is explicit and reviewable here. */
  | { type: "link"; text: string; href: string }
  /** Rendered as a real FAQ (Accordion) section under its own "FAQ" H2 --
   * only articles that actually have one emit FAQPage JSON-LD. */
  | { type: "faq"; items: { question: string; answer: string }[] };

export type ConseilArticle = {
  id: string;
  slug: string;
  title: string;
  /** Listing-card excerpt / OG fallback description -- kept short and human, distinct from seoDescription. */
  description: string;
  /** Unique <title>, ~60 characters, natural (no keyword stuffing). */
  seoTitle: string;
  /** Unique <meta name="description">, ~155 characters, click-oriented. */
  seoDescription: string;
  categorySlug: string;
  date: string;
  /** Same as `date` when the article has never been revised -- never backdated/fabricated. */
  updatedAt: string;
  readingTime: string;
  /** Always "SAOVIA Food" -- no invented byline, per the editorial-trust rule. */
  author: string;
  image: string;
  /** Real, descriptive alt text for `image` -- never empty. */
  imageAlt: string;
  /** Search-intent variants this article targets (used in <meta name="keywords">, not stuffed into visible copy). */
  keywords: string[];
  /** Explicit "articles similaires" picks (kept explicit everywhere for predictable, curated results rather than relying on same-category fallback). */
  relatedSlugs: string[];
  content: ConseilContentBlock[];
};

export const CONSEIL_ARTICLES: ConseilArticle[] = [
  {
    id: "attirer-plus-de-clients-restaurant",
    slug: "attirer-plus-de-clients-restaurant",
    title: "10 stratégies pour attirer plus de clients dans votre restaurant",
    description:
      "Découvrez des stratégies simples et efficaces pour attirer plus de clients et augmenter vos ventes.",
    seoTitle: "Attirer plus de clients dans son restaurant : 10 stratégies",
    seoDescription:
      "10 stratégies concrètes pour attirer plus de clients dans votre restaurant : présence digitale, réseaux sociaux, QR Code, avis clients et fidélisation.",
    categorySlug: "developper-son-restaurant",
    date: "5 sept. 2026",
    updatedAt: "5 sept. 2026",
    readingTime: "5 min de lecture",
    author: "SAOVIA Food",
    image: heroImmersiveImage,
    imageAlt: "Restaurateur souriant présentant son restaurant, prêt à accueillir plus de clients",
    keywords: ["attirer plus de clients restaurant", "augmenter clientèle restaurant", "développer son restaurant"],
    relatedSlugs: ["menu-digital-restaurant", "attirer-clients-restaurant-abidjan", "fideliser-clients-restaurant"],
    content: [
      {
        type: "paragraph",
        text: "Attirer de nouveaux clients ne dépend pas uniquement de la qualité de vos plats. La façon dont votre restaurant est présenté, découvert et vécu par vos clients joue un rôle tout aussi important. Voici 10 stratégies concrètes pour développer votre clientèle.",
      },
      {
        type: "list",
        items: [
          "Soignez vos photos de plats -- des visuels appétissants donnent envie de commander avant même d'avoir goûté.",
          "Mettez votre menu à jour régulièrement pour refléter vos meilleurs plats et vos nouveautés.",
          "Facilitez l'accès à votre menu avec un QR Code affiché sur vos tables, flyers et emballages.",
          "Encouragez vos clients satisfaits à laisser un avis en ligne.",
          "Soyez présent et actif sur les réseaux sociaux avec du contenu régulier.",
          "Proposez des offres et promotions ponctuelles pour créer de l'engagement.",
          "Facilitez la commande en ligne pour réduire les frictions à l'achat.",
          "Suivez vos statistiques de vente pour identifier ce qui fonctionne le mieux.",
          "Centralisez l'historique de vos clients pour mieux les connaître et les fidéliser.",
          "Restez cohérent dans votre identité visuelle, du menu jusqu'à vos réseaux sociaux.",
        ],
      },
      {
        type: "heading",
        text: "Une base solide : votre présence digitale",
      },
      {
        type: "paragraph",
        text: "Beaucoup de ces stratégies reposent sur une bonne présence digitale. Un menu digital à jour, un QR Code accessible partout et un espace pour suivre vos ventes forment une base solide pour construire toutes vos actions d'acquisition et de fidélisation.",
      },
      {
        type: "link",
        text: "Découvrez toutes les fonctionnalités de SAOVIA Food",
        href: "/food#fonctionnalites",
      },
      {
        type: "faq",
        items: [
          {
            question: "Par où commencer pour attirer plus de clients ?",
            answer:
              "Commencez par votre menu digital et votre QR Code : c'est la base sur laquelle reposent la plupart des autres actions (réseaux sociaux, promotions, commande en ligne).",
          },
          {
            question: "Faut-il un gros budget publicitaire pour attirer des clients ?",
            answer:
              "Non. Plusieurs des leviers ci-dessus (menu digital, QR Code, avis clients, réseaux sociaux) ne demandent aucun budget publicitaire, seulement de la régularité.",
          },
        ],
      },
    ],
  },
  {
    id: "menu-digital-restaurant",
    slug: "menu-digital-restaurant",
    title: "Menu digital : pourquoi votre restaurant devrait passer au numérique",
    description:
      "Menu digital, QR Code, commandes en ligne... Découvrez pourquoi le digital est un atout incontournable.",
    seoTitle: "Menu digital restaurant : pourquoi passer au numérique",
    seoDescription:
      "Menu digital, QR Code et commandes en ligne : découvrez pourquoi le menu digital est devenu un atout incontournable pour un restaurant moderne.",
    categorySlug: "digitaliser-son-restaurant",
    date: "2 sept. 2026",
    updatedAt: "2 sept. 2026",
    readingTime: "4 min de lecture",
    author: "SAOVIA Food",
    image: menuDigitalShowcaseImage,
    imageAlt: "Support de table avec QR Code et menu digital SAOVIA Food affiché sur un smartphone",
    keywords: ["menu digital restaurant", "menu numérique restaurant", "menu QR code restaurant"],
    relatedSlugs: ["qr-code-restaurant", "commande-en-ligne-restaurant", "digitaliser-restaurant-cote-divoire"],
    content: [
      {
        type: "paragraph",
        text: "Le menu papier a longtemps été la norme dans les restaurants. Aujourd'hui, de plus en plus d'établissements font le choix du menu digital -- et les raisons sont nombreuses.",
      },
      {
        type: "heading",
        text: "Toujours à jour, sans coût de réimpression",
      },
      {
        type: "paragraph",
        text: "Un plat en rupture, un prix qui change, une nouveauté à ajouter : avec un menu digital, ces mises à jour sont immédiates et ne nécessitent aucune réimpression.",
      },
      {
        type: "heading",
        text: "Un accès instantané grâce au QR Code",
      },
      {
        type: "paragraph",
        text: "Un QR Code unique généré pour votre restaurant permet à vos clients d'accéder directement à votre menu depuis leur téléphone -- sur vos tables, vos flyers ou vos emballages, sans application à installer.",
      },
      {
        type: "heading",
        text: "Une meilleure expérience client",
      },
      {
        type: "paragraph",
        text: "Photos, descriptions claires, disponibilité en temps réel : un menu digital bien présenté aide vos clients à choisir plus facilement, et donne une image moderne et professionnelle de votre restaurant.",
      },
      {
        type: "paragraph",
        text: "Combiné aux commandes en ligne, le menu digital devient le point de départ d'une expérience client fluide, du premier scan jusqu'à la commande.",
      },
      {
        type: "link",
        text: "Voir les tarifs SAOVIA Food",
        href: "/food#tarifs",
      },
      {
        type: "faq",
        items: [
          {
            question: "Un client doit-il installer une application pour voir mon menu digital ?",
            answer:
              "Non. Le menu digital s'ouvre directement dans le navigateur du téléphone après un scan du QR Code, sans aucune application à installer.",
          },
          {
            question: "Puis-je modifier mon menu digital moi-même ?",
            answer:
              "Oui, vous mettez à jour vos plats, prix, photos et disponibilités vous-même depuis votre espace SAOVIA Food, sans passer par un développeur.",
          },
        ],
      },
    ],
  },
  {
    id: "augmenter-commandes-restaurant-digital",
    slug: "augmenter-commandes-restaurant-digital",
    title: "Comment augmenter les commandes de votre restaurant avec le digital",
    description:
      "Réseaux sociaux, Meta Ads, promotions... Des conseils concrets pour booster vos commandes.",
    seoTitle: "Augmenter les commandes de son restaurant grâce au digital",
    seoDescription:
      "Des conseils concrets pour augmenter les commandes de votre restaurant : commande en ligne, promotions, réseaux sociaux et suivi des statistiques.",
    categorySlug: "marketing-visibilite",
    date: "28 août 2026",
    updatedAt: "28 août 2026",
    readingTime: "6 min de lecture",
    author: "SAOVIA Food",
    image: grillades,
    imageAlt: "Assiette de grillades africaines prête à être servie, symbole des commandes à préparer",
    keywords: ["augmenter commandes restaurant", "booster ventes restaurant", "commande en ligne restaurant"],
    relatedSlugs: ["commande-en-ligne-restaurant", "meta-ads-restaurant", "fideliser-clients-restaurant"],
    content: [
      {
        type: "paragraph",
        text: "Le digital offre aux restaurateurs des leviers concrets pour augmenter le nombre de commandes, sans dépendre uniquement du passage en salle. Voici comment les utiliser efficacement.",
      },
      {
        type: "heading",
        text: "Facilitez la commande en ligne",
      },
      {
        type: "paragraph",
        text: "Plus le parcours de commande est simple, plus vos clients commandent. Un menu digital clair, connecté à un système de commandes en ligne, réduit les frictions et les abandons.",
      },
      {
        type: "heading",
        text: "Utilisez les promotions intelligemment",
      },
      {
        type: "paragraph",
        text: "Des codes promo et des offres ponctuelles, avec un suivi réel de leur utilisation, permettent de stimuler les ventes lors des périodes plus calmes ou d'encourager une première commande.",
      },
      {
        type: "heading",
        text: "Développez votre visibilité sur les réseaux sociaux",
      },
      {
        type: "paragraph",
        text: "Facebook et Instagram restent des canaux puissants pour faire connaître votre restaurant. En activant votre Meta Pixel, vous préparez également le suivi de vos futures campagnes publicitaires.",
      },
      {
        type: "heading",
        text: "Suivez vos statistiques pour ajuster vos actions",
      },
      {
        type: "paragraph",
        text: "Un tableau de bord de vos ventes et commandes vous aide à comprendre ce qui fonctionne réellement, et à concentrer vos efforts marketing sur les actions les plus rentables.",
      },
      {
        type: "link",
        text: "Lire aussi : mettre en place la commande en ligne",
        href: "/food/conseils/commande-en-ligne-restaurant",
      },
      {
        type: "faq",
        items: [
          {
            question: "Les promotions font-elles vraiment baisser mes marges ?",
            answer:
              "Utilisées ponctuellement et suivies avec de vraies statistiques d'utilisation, les promotions servent surtout à générer des commandes supplémentaires (nouveaux clients, périodes creuses) plutôt qu'à réduire vos marges au quotidien.",
          },
        ],
      },
    ],
  },
  {
    id: "qr-code-restaurant",
    slug: "qr-code-restaurant",
    title: "QR Code restaurant : comment ça marche et pourquoi l'adopter",
    description:
      "Comment fonctionne un QR Code pour restaurant, où l'afficher et pourquoi il facilite l'accès à votre menu.",
    seoTitle: "QR Code restaurant : comment ça marche et pourquoi l'adopter",
    seoDescription:
      "Comment fonctionne un QR Code pour restaurant, où l'afficher (tables, flyers, emballages) et pourquoi il facilite l'accès à votre menu digital.",
    categorySlug: "digitaliser-son-restaurant",
    date: "8 sept. 2026",
    updatedAt: "8 sept. 2026",
    readingTime: "4 min de lecture",
    author: "SAOVIA Food",
    image: poulet,
    imageAlt: "Plat de poulet grillé accompagné de légumes, présenté comme sur un menu digital consultable par QR Code",
    keywords: ["QR code restaurant", "QR code restaurant Côte d'Ivoire", "menu QR code"],
    relatedSlugs: ["menu-digital-restaurant", "commande-en-ligne-restaurant", "digitaliser-restaurant-cote-divoire"],
    content: [
      {
        type: "paragraph",
        text: "De plus en plus de restaurants affichent un QR Code sur leurs tables plutôt qu'un menu papier. Simple pour le client, pratique pour le restaurateur : voici comment ça fonctionne concrètement et pourquoi l'adopter.",
      },
      {
        type: "heading",
        text: "Comment fonctionne un QR Code pour restaurant ?",
      },
      {
        type: "paragraph",
        text: "Un QR Code restaurant est un code-image unique, propre à votre établissement. Un client le scanne avec l'appareil photo de son téléphone et accède directement à votre menu digital, sans installer d'application ni saisir d'adresse.",
      },
      {
        type: "heading",
        text: "Où afficher votre QR Code",
      },
      {
        type: "list",
        items: [
          "Sur vos tables, pour un accès immédiat au menu pendant le service.",
          "Sur vos flyers et supports imprimés, pour prolonger votre visibilité en dehors du restaurant.",
          "Sur vos emballages à emporter ou en livraison, pour que le client redécouvre votre menu chez lui.",
          "Sur vos réseaux sociaux, en story ou en bio, pour rediriger directement vers votre menu digital.",
        ],
      },
      {
        type: "heading",
        text: "Pourquoi l'adopter",
      },
      {
        type: "paragraph",
        text: "Un menu accessible par QR Code élimine les coûts de réimpression, reste toujours à jour et donne une image moderne à votre restaurant. Avec SAOVIA Food, ce QR Code est généré automatiquement pour chaque restaurant, dès la création de votre menu digital.",
      },
      {
        type: "link",
        text: "Lire aussi : pourquoi passer au menu digital",
        href: "/food/conseils/menu-digital-restaurant",
      },
      {
        type: "faq",
        items: [
          {
            question: "Le QR Code de mon restaurant a-t-il un coût supplémentaire ?",
            answer:
              "Non. Le QR Code est généré automatiquement avec votre menu digital SAOVIA Food, sans coût additionnel ni configuration technique de votre part.",
          },
          {
            question: "Le QR Code change-t-il si je modifie mon menu ?",
            answer:
              "Non, votre QR Code reste le même : vous pouvez imprimer vos supports une seule fois, puis mettre à jour votre menu autant de fois que nécessaire.",
          },
          {
            question: "Un client a-t-il besoin d'une application pour scanner le QR Code ?",
            answer:
              "Non, l'appareil photo natif de la plupart des smartphones suffit à scanner le QR Code et à ouvrir directement le menu dans le navigateur.",
          },
        ],
      },
    ],
  },
  {
    id: "commande-en-ligne-restaurant",
    slug: "commande-en-ligne-restaurant",
    title: "Mettre en place la commande en ligne dans son restaurant",
    description:
      "Ce que change la commande en ligne au quotidien, et comment la mettre en place simplement dans votre restaurant.",
    seoTitle: "Commande en ligne restaurant : comment la mettre en place",
    seoDescription:
      "Comment mettre en place la commande en ligne dans votre restaurant : ce que ça change au quotidien pour vos clients et pour la gestion de vos ventes.",
    categorySlug: "digitaliser-son-restaurant",
    date: "6 sept. 2026",
    updatedAt: "6 sept. 2026",
    readingTime: "5 min de lecture",
    author: "SAOVIA Food",
    image: poisson,
    imageAlt: "Poisson braisé aux légumes, plat typique proposé à la commande en ligne dans un restaurant",
    keywords: ["commande en ligne restaurant", "système de commande restaurant", "commander en ligne restaurant"],
    relatedSlugs: ["menu-digital-restaurant", "qr-code-restaurant", "augmenter-commandes-restaurant-digital"],
    content: [
      {
        type: "paragraph",
        text: "Recevoir des commandes par téléphone ou par message devient vite difficile à gérer quand l'activité grandit. La commande en ligne centralise tout au même endroit -- voici ce que ça change concrètement, et comment la mettre en place.",
      },
      {
        type: "heading",
        text: "Ce que change la commande en ligne au quotidien",
      },
      {
        type: "list",
        items: [
          "Plus d'erreurs de commande liées à un appel mal compris.",
          "Toutes les commandes centralisées dans un seul espace, en temps réel.",
          "Un client peut commander à tout moment, même quand la ligne est occupée.",
          "Un suivi clair de chaque commande, de sa réception à sa préparation.",
        ],
      },
      {
        type: "heading",
        text: "Comment la mettre en place",
      },
      {
        type: "paragraph",
        text: "La commande en ligne s'appuie d'abord sur un menu digital clair et à jour. Une fois ce menu en place, vos clients peuvent commander directement depuis leur téléphone -- après avoir scanné votre QR Code, par exemple -- et vous recevez chaque commande directement dans votre espace de gestion.",
      },
      {
        type: "heading",
        text: "Un point de départ pour la livraison",
      },
      {
        type: "paragraph",
        text: "Une fois la commande en ligne en place, organiser vos livraisons et suivre vos livreurs devient une suite naturelle : la commande, la préparation et la livraison s'enchaînent depuis le même espace.",
      },
      {
        type: "link",
        text: "Découvrez toutes les fonctionnalités de SAOVIA Food",
        href: "/food#fonctionnalites",
      },
      {
        type: "faq",
        items: [
          {
            question: "Ai-je besoin d'un site web pour proposer la commande en ligne ?",
            answer:
              "Non. Votre menu digital sert directement de vitrine et de point de commande : votre restaurant n'a pas besoin d'un site web séparé pour démarrer.",
          },
          {
            question: "Comment un client passe-t-il commande concrètement ?",
            answer:
              "Il accède à votre menu digital (par exemple via votre QR Code), choisit ses plats, puis valide sa commande, que vous recevez immédiatement dans votre espace de gestion.",
          },
        ],
      },
    ],
  },
  {
    id: "digitaliser-restaurant-cote-divoire",
    slug: "digitaliser-restaurant-cote-divoire",
    title: "Guide pratique pour digitaliser un restaurant en Côte d'Ivoire",
    description:
      "Menu digital, QR Code, commande en ligne : les étapes concrètes pour digitaliser votre restaurant en Côte d'Ivoire.",
    seoTitle: "Digitaliser un restaurant en Côte d'Ivoire : guide pratique",
    seoDescription:
      "Guide pratique pour digitaliser un restaurant en Côte d'Ivoire : menu digital, QR Code, commande en ligne et outils adaptés aux restaurateurs ivoiriens.",
    categorySlug: "digitaliser-son-restaurant",
    date: "4 sept. 2026",
    updatedAt: "4 sept. 2026",
    readingTime: "6 min de lecture",
    author: "SAOVIA Food",
    image: alloco,
    imageAlt: "Alloco, plat ivoirien de bananes plantains frites, symbole de la cuisine locale en Côte d'Ivoire",
    keywords: ["digitaliser restaurant Côte d'Ivoire", "logiciel restaurant Côte d'Ivoire", "menu digital restaurant Côte d'Ivoire"],
    relatedSlugs: ["menu-digital-restaurant", "qr-code-restaurant", "attirer-clients-restaurant-abidjan"],
    content: [
      {
        type: "paragraph",
        text: "De plus en plus de restaurateurs en Côte d'Ivoire font le choix de digitaliser leur établissement : menu digital, QR Code, commande en ligne. Voici les étapes concrètes pour s'y mettre, sans compétence technique particulière.",
      },
      {
        type: "heading",
        text: "1. Mettre en place un menu digital",
      },
      {
        type: "paragraph",
        text: "La première étape consiste à créer un menu digital avec vos plats, vos prix et vos photos. Il devient accessible depuis un téléphone, une tablette ou un ordinateur, sans application à installer -- un vrai atout dans un contexte où le mobile est le premier réflexe des clients.",
      },
      {
        type: "heading",
        text: "2. Générer votre QR Code",
      },
      {
        type: "paragraph",
        text: "Une fois votre menu en ligne, un QR Code propre à votre restaurant est généré automatiquement. Affiché sur vos tables, vos flyers ou vos emballages, il permet à vos clients d'accéder directement à votre menu, à Abidjan comme dans les autres villes du pays.",
      },
      {
        type: "heading",
        text: "3. Activer la commande en ligne",
      },
      {
        type: "paragraph",
        text: "Avec un menu digital en place, vous pouvez ensuite ouvrir la commande en ligne : vos clients commandent directement depuis leur téléphone, et vous recevez chaque commande dans un espace unique.",
      },
      {
        type: "heading",
        text: "4. Garder le contrôle de votre activité",
      },
      {
        type: "paragraph",
        text: "Avec SAOVIA Food, aucune commission n'est prélevée sur vos ventes : vous payez uniquement un abonnement simple, à partir de 10 000 F par mois, et vous gardez 100 % de vos revenus.",
      },
      {
        type: "link",
        text: "Lire aussi : attirer plus de clients pour un restaurant à Abidjan",
        href: "/food/conseils/attirer-clients-restaurant-abidjan",
      },
      {
        type: "faq",
        items: [
          {
            question: "Digitaliser mon restaurant en Côte d'Ivoire demande-t-il des compétences techniques ?",
            answer:
              "Non. La création du menu digital, la génération du QR Code et la gestion des commandes se font depuis un espace simple, pensé pour être utilisé sans compétence technique.",
          },
          {
            question: "SAOVIA Food fonctionne-t-il dans toutes les villes de Côte d'Ivoire ?",
            answer:
              "Oui, SAOVIA Food est une application web accessible partout où vos clients ont une connexion internet, à Abidjan comme dans les autres villes du pays.",
          },
        ],
      },
    ],
  },
  {
    id: "attirer-clients-restaurant-abidjan",
    slug: "attirer-clients-restaurant-abidjan",
    title: "Comment attirer plus de clients pour un restaurant à Abidjan",
    description:
      "Des leviers concrets -- menu digital, réseaux sociaux, avis clients -- pour attirer plus de clients dans un restaurant à Abidjan.",
    seoTitle: "Attirer plus de clients pour un restaurant à Abidjan",
    seoDescription:
      "Des leviers concrets pour attirer plus de clients dans un restaurant à Abidjan : menu digital, QR Code, réseaux sociaux et avis clients.",
    categorySlug: "developper-son-restaurant",
    date: "3 sept. 2026",
    updatedAt: "3 sept. 2026",
    readingTime: "5 min de lecture",
    author: "SAOVIA Food",
    image: placali,
    imageAlt: "Placali accompagné de sauce, plat traditionnel souvent servi dans les restaurants à Abidjan",
    keywords: ["attirer plus de clients restaurant Abidjan", "restaurant Abidjan clients", "commande en ligne restaurant Abidjan"],
    relatedSlugs: ["digitaliser-restaurant-cote-divoire", "attirer-plus-de-clients-restaurant", "instagram-restaurant"],
    content: [
      {
        type: "paragraph",
        text: "Abidjan compte de nombreux restaurants, et la concurrence pour attirer l'attention des clients y est forte. Voici des leviers concrets, adaptés à ce contexte, pour développer votre clientèle.",
      },
      {
        type: "heading",
        text: "Facilitez la découverte de votre menu",
      },
      {
        type: "paragraph",
        text: "Un client pressé, dans une commune animée d'Abidjan, va vers ce qui est simple et rapide à consulter. Un menu digital accessible par QR Code, avec des photos claires, aide un client à se décider en quelques secondes.",
      },
      {
        type: "heading",
        text: "Soyez visible là où sont vos clients",
      },
      {
        type: "paragraph",
        text: "Facebook et Instagram restent des canaux très utilisés à Abidjan pour découvrir un nouveau restaurant. Publier régulièrement vos plats, vos nouveautés et vos offres du moment aide à rester présent dans l'esprit de vos clients.",
      },
      {
        type: "heading",
        text: "Simplifiez la commande, sur place comme à emporter",
      },
      {
        type: "paragraph",
        text: "Entre les embouteillages et les journées chargées, beaucoup de clients à Abidjan préfèrent commander à l'avance ou en ligne plutôt que d'attendre sur place. Une commande en ligne simple réduit cette friction et peut faire la différence.",
      },
      {
        type: "list",
        items: [
          "Un menu digital à jour, accessible par QR Code sur vos tables et vos emballages.",
          "Une présence régulière sur les réseaux sociaux, avec des visuels soignés.",
          "Des avis clients mis en avant pour rassurer les nouveaux visiteurs.",
          "Une commande en ligne simple pour réduire l'attente et les frictions.",
        ],
      },
      {
        type: "link",
        text: "Voir le guide complet pour digitaliser un restaurant en Côte d'Ivoire",
        href: "/food/conseils/digitaliser-restaurant-cote-divoire",
      },
      {
        type: "faq",
        items: [
          {
            question: "Quel est le premier levier à activer pour un restaurant à Abidjan ?",
            answer:
              "Le menu digital accessible par QR Code : c'est la base la plus rapide à mettre en place, et elle facilite immédiatement la découverte de votre menu.",
          },
          {
            question: "Faut-il être présent sur tous les réseaux sociaux ?",
            answer:
              "Non, mieux vaut être régulier sur un ou deux réseaux (souvent Facebook et Instagram à Abidjan) plutôt que présent partout de façon irrégulière.",
          },
        ],
      },
    ],
  },
  {
    id: "meta-ads-restaurant",
    slug: "meta-ads-restaurant",
    title: "Utiliser Meta Ads pour faire connaître son restaurant",
    description:
      "Meta Pixel, ciblage, budget : les bases pour utiliser Meta Ads (Facebook et Instagram) et faire connaître votre restaurant.",
    seoTitle: "Meta Ads restaurant : les bases pour se lancer",
    seoDescription:
      "Meta Pixel, ciblage local, budget : les bases pour utiliser Meta Ads (Facebook et Instagram) et faire connaître votre restaurant efficacement.",
    categorySlug: "marketing-visibilite",
    date: "1 sept. 2026",
    updatedAt: "1 sept. 2026",
    readingTime: "5 min de lecture",
    author: "SAOVIA Food",
    image: foutou,
    imageAlt: "Foutou accompagné de sauce graine, plat mis en avant dans une campagne Meta Ads pour restaurant",
    keywords: ["Meta Ads restaurant", "publicité Facebook restaurant", "publicité Instagram restaurant"],
    relatedSlugs: ["instagram-restaurant", "augmenter-commandes-restaurant-digital", "attirer-plus-de-clients-restaurant"],
    content: [
      {
        type: "paragraph",
        text: "Meta Ads permet de diffuser des publicités sur Facebook et Instagram pour faire connaître votre restaurant à de nouveaux clients, dans un rayon géographique précis. Voici les bases pour bien démarrer.",
      },
      {
        type: "heading",
        text: "Commencez par le Meta Pixel",
      },
      {
        type: "paragraph",
        text: "Avant de lancer une campagne, il est utile d'activer votre Meta Pixel : un petit outil de mesure qui prépare le suivi de vos futures campagnes publicitaires et vous aide à comprendre le comportement des visiteurs qui découvrent votre restaurant en ligne.",
      },
      {
        type: "heading",
        text: "Ciblez la bonne zone géographique",
      },
      {
        type: "paragraph",
        text: "L'un des grands avantages de Meta Ads pour un restaurant est le ciblage local : vous pouvez diffuser vos publicités uniquement aux personnes situées à proximité de votre établissement, plutôt qu'à une audience trop large.",
      },
      {
        type: "heading",
        text: "Mettez en avant vos plats et vos offres",
      },
      {
        type: "paragraph",
        text: "Une photo de plat appétissante, une offre du moment ou une nouveauté au menu font généralement de meilleures publicités qu'un message purement institutionnel. Restez concret et visuel.",
      },
      {
        type: "heading",
        text: "Commencez petit, puis ajustez",
      },
      {
        type: "paragraph",
        text: "Il n'est pas nécessaire de démarrer avec un budget important. Testez une publicité simple, observez vos statistiques, puis ajustez le ciblage, le visuel ou le budget selon les résultats.",
      },
      {
        type: "link",
        text: "Lire aussi : utiliser Instagram pour développer son restaurant",
        href: "/food/conseils/instagram-restaurant",
      },
      {
        type: "faq",
        items: [
          {
            question: "Qu'est-ce que le Meta Pixel exactement ?",
            answer:
              "C'est un outil de mesure de Meta (Facebook/Instagram) qui aide à comprendre l'activité liée à vos publicités. Vous pouvez l'activer directement depuis votre espace SAOVIA Food.",
          },
          {
            question: "Faut-il un gros budget pour commencer avec Meta Ads ?",
            answer:
              "Non, il est tout à fait possible de commencer avec un budget modeste, de suivre les résultats, puis d'ajuster progressivement selon ce qui fonctionne.",
          },
        ],
      },
    ],
  },
  {
    id: "instagram-restaurant",
    slug: "instagram-restaurant",
    title: "Utiliser Instagram pour développer son restaurant",
    description:
      "Contenu, régularité, storytelling : comment utiliser Instagram efficacement pour développer votre restaurant.",
    seoTitle: "Instagram pour restaurant : comment développer son activité",
    seoDescription:
      "Contenu, régularité, storytelling : comment utiliser Instagram efficacement pour développer votre restaurant et attirer de nouveaux clients.",
    categorySlug: "marketing-visibilite",
    date: "30 août 2026",
    updatedAt: "30 août 2026",
    readingTime: "4 min de lecture",
    author: "SAOVIA Food",
    image: heroPlatter,
    imageAlt: "Assiette généreuse de poulet, poisson braisé, riz et alloco, mise en scène pour un contenu Instagram",
    keywords: ["Instagram restaurant", "réseaux sociaux restaurant", "marketing restaurant Instagram"],
    relatedSlugs: ["meta-ads-restaurant", "attirer-plus-de-clients-restaurant", "fideliser-clients-restaurant"],
    content: [
      {
        type: "paragraph",
        text: "Instagram est devenu l'un des premiers réflexes d'un client pour découvrir un restaurant avant de s'y rendre. Voici comment l'utiliser efficacement, sans y passer des heures chaque jour.",
      },
      {
        type: "heading",
        text: "Misez sur des visuels appétissants",
      },
      {
        type: "paragraph",
        text: "Sur Instagram, la photo fait tout le travail. Une belle lumière, un cadrage soigné et des plats bien présentés donnent envie de venir goûter -- avant même de lire la description.",
      },
      {
        type: "heading",
        text: "Restez régulier plutôt que parfait",
      },
      {
        type: "paragraph",
        text: "Mieux vaut publier régulièrement du contenu simple qu'un contenu très travaillé mais irrégulier. La régularité entretient la visibilité de votre restaurant dans le temps.",
      },
      {
        type: "heading",
        text: "Racontez votre restaurant, pas seulement vos plats",
      },
      {
        type: "list",
        items: [
          "Montrez les coulisses de votre cuisine et de votre équipe.",
          "Partagez les avis et retours de vos clients.",
          "Mettez en avant vos nouveautés et vos offres du moment.",
          "Ajoutez le lien vers votre menu digital dans votre bio.",
        ],
      },
      {
        type: "paragraph",
        text: "En plaçant le lien de votre menu digital directement dans votre bio Instagram, un client qui découvre votre page peut consulter votre menu -- et commander -- en un seul geste.",
      },
      {
        type: "link",
        text: "Découvrez toutes les fonctionnalités de SAOVIA Food",
        href: "/food#fonctionnalites",
      },
      {
        type: "faq",
        items: [
          {
            question: "À quelle fréquence publier sur Instagram pour un restaurant ?",
            answer:
              "Quelques publications régulières par semaine suffisent généralement, à condition d'être constant dans la durée plutôt que ponctuel.",
          },
          {
            question: "Comment relier mon compte Instagram à mon menu digital ?",
            answer:
              "Ajoutez simplement le lien de votre menu digital SAOVIA Food dans la bio de votre compte Instagram, pour que vos abonnés puissent le consulter en un clic.",
          },
        ],
      },
    ],
  },
  {
    id: "fideliser-clients-restaurant",
    slug: "fideliser-clients-restaurant",
    title: "Comment fidéliser vos clients grâce au digital",
    description:
      "Historique client, promotions ciblées, expérience fluide : comment fidéliser durablement la clientèle de votre restaurant.",
    seoTitle: "Fidéliser ses clients restaurant grâce au digital",
    seoDescription:
      "Historique client, promotions ciblées et expérience fluide : comment fidéliser durablement la clientèle de votre restaurant grâce au digital.",
    categorySlug: "gestion-operations",
    date: "26 août 2026",
    updatedAt: "26 août 2026",
    readingTime: "5 min de lecture",
    author: "SAOVIA Food",
    image: saoviaAppShowcase,
    imageAlt: "Restauratrice présentant l'espace de gestion SAOVIA Food sur smartphone, utilisé pour suivre ses clients",
    keywords: ["fidélisation clients restaurant", "fidéliser clientèle restaurant", "gestion clients restaurant"],
    relatedSlugs: ["augmenter-commandes-restaurant-digital", "attirer-plus-de-clients-restaurant", "menu-digital-restaurant"],
    content: [
      {
        type: "paragraph",
        text: "Attirer un nouveau client coûte généralement plus d'efforts que de faire revenir un client déjà satisfait. Voici comment le digital vous aide à fidéliser durablement votre clientèle.",
      },
      {
        type: "heading",
        text: "Connaissez mieux vos clients",
      },
      {
        type: "paragraph",
        text: "Centraliser l'historique de vos clients -- leurs commandes passées, leurs préférences -- vous permet de mieux les connaître et d'adapter vos offres en conséquence, plutôt que de repartir de zéro à chaque visite.",
      },
      {
        type: "heading",
        text: "Utilisez des promotions ciblées",
      },
      {
        type: "paragraph",
        text: "Une offre ponctuelle adressée à vos clients existants -- pour une nouveauté, une occasion particulière ou après une absence -- peut suffire à déclencher une nouvelle commande.",
      },
      {
        type: "heading",
        text: "Offrez une expérience fluide, à chaque commande",
      },
      {
        type: "paragraph",
        text: "Un menu digital clair, une commande simple et un suivi fiable de la livraison créent une expérience sans friction. Plus cette expérience est fluide, plus un client a de raisons de revenir.",
      },
      {
        type: "list",
        items: [
          "Centralisez l'historique de vos clients pour personnaliser vos offres.",
          "Utilisez des promotions ponctuelles pour réactiver les clients absents.",
          "Gardez un menu et un parcours de commande toujours simples et à jour.",
          "Suivez vos statistiques pour identifier vos clients les plus fidèles.",
        ],
      },
      {
        type: "link",
        text: "Lire aussi : augmenter les commandes de son restaurant avec le digital",
        href: "/food/conseils/augmenter-commandes-restaurant-digital",
      },
      {
        type: "faq",
        items: [
          {
            question: "Comment SAOVIA Food m'aide-t-il à fidéliser mes clients ?",
            answer:
              "SAOVIA Food centralise l'historique de vos clients et vous donne des outils de promotions avec suivi réel, pour identifier vos clients réguliers et leur adresser des offres pertinentes.",
          },
          {
            question: "La fidélisation demande-t-elle beaucoup de temps au quotidien ?",
            answer:
              "Non. L'essentiel repose sur des outils déjà en place (historique client, promotions, statistiques) que vous consultez ponctuellement, plutôt que sur une gestion manuelle chronophage.",
          },
        ],
      },
    ],
  },
];

export function getArticle(slug: string): ConseilArticle | undefined {
  return CONSEIL_ARTICLES.find((a) => a.slug === slug);
}

/** "Articles similaires": explicit relatedSlugs (curated per article, see
 * above) resolved to real articles, capped at `max`. Unknown/self slugs are
 * silently dropped rather than throwing, so a future typo in relatedSlugs
 * degrades gracefully instead of crashing the page. */
export function getRelatedArticles(article: ConseilArticle, max = 3): ConseilArticle[] {
  return article.relatedSlugs
    .map((slug) => getArticle(slug))
    .filter((a): a is ConseilArticle => Boolean(a) && a!.slug !== article.slug)
    .slice(0, max);
}
