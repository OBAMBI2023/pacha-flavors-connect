# Déploiement sur saovia.net

Ce document couvre uniquement le passage de l'app au domaine officiel
`https://saovia.net`. Il ne modifie aucun réglage Supabase en production --
c'est une checklist à exécuter au moment de l'achat/connexion du domaine.

## 1. Comment l'app résout ses propres URLs

Deux mécanismes coexistent, aucun des deux ne doit être modifié :

- **`window.location.origin`** (Auth Supabase, activation livreur, QR code
  tenant) -- suit automatiquement le domaine réel (`localhost:5173` en dev,
  `https://saovia.net` en prod) sans aucune configuration. Rien à faire ici,
  ni maintenant ni après l'achat du domaine.
- **`VITE_SITE_URL`** (balises SEO : canonical, Open Graph, Twitter Card,
  JSON-LD dans `src/lib/seo.ts`) -- ces balises sont générées côté serveur
  (SSR) où `window` n'existe pas, donc elles ne peuvent pas suivre
  `window.location.origin`. Cette variable est la seule "source centrale"
  nécessaire. Si elle n'est pas définie, le code retombe sur
  `https://saovia.net` par défaut (voir `siteOrigin()` dans `src/lib/seo.ts`).

## 2. Variable d'environnement à configurer chez l'hébergeur

```
VITE_SITE_URL=https://saovia.net
```

À définir dans les variables d'environnement de production de l'hébergeur
(Vercel/Netlify/autre). Voir `.env.example` à la racine du projet. Aucune
valeur locale à changer : `.env` reste tel quel pour le développement.

## 3. Supabase Auth -- à mettre à jour après connexion du domaine

Dans le dashboard Supabase du projet (Authentication → URL Configuration),
une fois `https://saovia.net` réellement en ligne et vérifié :

- **Site URL** : `https://saovia.net`
- **Redirect URLs** à ajouter (en plus de celles déjà existantes pour
  `localhost:5173`, à conserver pour continuer à développer en local) :
  - `https://saovia.net/auth` -- callback "mot de passe oublié" espace
    partenaire (`src/routes/auth.tsx`)
  - `https://saovia.net/livreur/activation` -- callback "mot de passe
    oublié" + activation compte livreur (`src/lib/drivers.ts`,
    `DRIVER_ACTIVATION_PATH`)

⚠️ Ne pas retirer les URLs `localhost:5173` existantes tant que le
développement local en a besoin. Ne pas toucher à ces réglages avant que le
domaine soit effectivement pointé et le certificat HTTPS actif -- une
Redirect URL qui ne répond pas encore casserait les emails déjà en file
d'attente.

## 4. DNS -- à documenter au moment de l'achat

Les enregistrements exacts dépendent de l'hébergeur choisi pour servir l'app
(Vercel, Netlify, etc.) ; à récupérer dans son dashboard "Domains" au moment
de connecter `saovia.net`. Généralement :

- Un enregistrement **A** (ou **ALIAS/ANAME**) sur `saovia.net` (apex)
  pointant vers l'IP/service fourni par l'hébergeur.
- Un enregistrement **CNAME** sur `www.saovia.net` pointant vers le domaine
  fourni par l'hébergeur.
- Redirection `www.saovia.net` → `saovia.net` : à activer côté hébergeur si
  disponible (Vercel/Netlify le font nativement une fois les deux domaines
  ajoutés au projet).
- HTTPS : émis automatiquement par la plupart des hébergeurs (Let's Encrypt)
  dès que le DNS pointe correctement -- rien à faire manuellement dans le
  code.

## 5. QR codes et liens publics

Aucune action requise : le QR code de chaque tenant (`QrCodeCard.tsx`) encode
`window.location.origin`, donc dès que l'app est servie depuis
`https://saovia.net`, tout QR régénéré (téléchargé/imprimé) après cette date
pointera automatiquement vers `https://saovia.net/r/<slug>?source=qr`.

⚠️ Les QR déjà imprimés avant la bascule pointent vers l'ancien domaine --
prévoir leur réimpression une fois `saovia.net` en ligne.

## 6. Checklist "après achat du domaine"

1. Connecter `saovia.net` au projet chez l'hébergeur.
2. Configurer les enregistrements DNS (section 4).
3. Vérifier que le certificat HTTPS est actif sur `saovia.net` (et
   `www.saovia.net` si servi).
4. Définir `VITE_SITE_URL=https://saovia.net` dans les variables
   d'environnement de production de l'hébergeur.
5. Ajouter les Redirect URLs Supabase (section 3) -- après vérification que
   le domaine répond bien en HTTPS.
6. Redéployer.
7. Vérifier : `/auth` (connexion + mot de passe oublié), `/livreur`
   (connexion + activation), un QR code fraîchement généré, les balises
   `<head>` d'une page tenant (canonical/OG doivent afficher
   `https://saovia.net`, pas l'ancien placeholder).
