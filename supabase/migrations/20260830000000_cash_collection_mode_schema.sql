-- Encaissement livraison, étape 1/N: schéma additif uniquement. Prépare le
-- terrain pour permettre plus tard au restaurant OU au livreur d'encaisser
-- une commande en livraison (voir l'audit du 30/08), sans activer aucune
-- nouvelle capacité maintenant -- aucune RPC ni aucun composant frontend
-- n'est touché par cette migration, et aucun d'eux ne lit encore ces deux
-- colonnes. Le comportement actuel (livreur seul autorisé sur une commande
-- delivery, mark_cash_payment_received bloqué pour fulfillment_type =
-- 'delivery') reste strictement identique.

-- ---------------------------------------------------------------------------
-- 1) restaurant_settings.cash_collection_mode -- réglage par tenant, pas
--    encore lu par aucune RPC. Défaut 'driver' pour que chaque tenant
--    existant et chaque nouveau tenant conservent exactement le
--    comportement actuel tant que l'étape 2 n'active rien.
-- ---------------------------------------------------------------------------

alter table public.restaurant_settings
  add column cash_collection_mode text not null default 'driver'
    check (cash_collection_mode in ('driver', 'restaurant', 'both'));

-- ---------------------------------------------------------------------------
-- 2) payments.collector_type -- identifie explicitement l'acteur qui a
--    collecté, en complément (jamais en remplacement) de
--    collected_by_driver_id, qui reste inchangé et continue d'être la
--    donnée que driver_confirm_cash_payment écrit. Nullable: reste NULL
--    partout où l'acteur ne peut pas être déterminé sans ambiguïté
--    (remboursements, statuts autres que 'paid').
-- ---------------------------------------------------------------------------

alter table public.payments
  add column collector_type text null
    check (collector_type in ('restaurant', 'driver', 'system'));

-- ---------------------------------------------------------------------------
-- 3) Backfill non destructif, strictement déterministe sur les lignes
--    existantes. collected_by_driver_id n'est jamais modifié.
--
--    - collected_by_driver_id is not null => forcément écrit par
--      driver_confirm_cash_payment => collector_type = 'driver'.
--    - collected_by_driver_id is null ET status = 'paid' => les deux seules
--      RPC qui insèrent dans payments avec un statut 'paid' sont
--      mark_cash_payment_received (jamais collected_by_driver_id) et
--      driver_confirm_cash_payment (toujours collected_by_driver_id) --
--      donc "paid + collected_by_driver_id null" ne peut provenir que de
--      mark_cash_payment_received => collector_type = 'restaurant', sans
--      ambiguïté.
--    - Tout le reste (remboursements créés par create_refund, tout statut
--      autre que 'paid') reste NULL : ce n'est pas une collecte, l'acteur
--      n'est pas inventé.
-- ---------------------------------------------------------------------------

update public.payments
  set collector_type = 'driver'
  where collected_by_driver_id is not null
    and collector_type is null;

update public.payments
  set collector_type = 'restaurant'
  where collected_by_driver_id is null
    and status = 'paid'
    and collector_type is null;
