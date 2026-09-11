# Phase 7D — bridge Nitro/Vercel

## Modification
- Importer `nitro` depuis `nitro/vite` dans `vite.config.ts`.
- Ajouter `nitro()` à la liste des plugins, après `tanstackStart()`, sans modifier les autres plugins ni configurer de preset Vercel explicite.
- Ne modifier aucun autre fichier applicatif, backend ou sécurité.

## Validation
- Exécuter `npm run build` et arrêter si Nitro casse la compilation ou n’émet pas la sortie attendue.
- Inspecter `dist/` pour confirmer les sorties client, SSR et Vercel/Nitro, sans `index.html` artificiel.
- Rejouer exactement la même mesure TypeScript avant/après et signaler l’écart avec le baseline d’audit annoncé.
- Vérifier `git diff`, l’absence de changement hors `vite.config.ts`, et l’intégrité des fichiers sensibles demandés.

## Détail technique
Nitro est déjà installé. Sa détection automatique de Vercel sera conservée ; aucun preset, `vercel.json`, endpoint maison ou paquet supplémentaire ne sera ajouté.
