-- Numérotation quotidienne des ventes et des livraisons.
--
-- Jusqu'ici le rang venait d'un « count(*) + 1 » sur les opérations du jour.
-- Deux ventes simultanées comptaient donc la même valeur, calculaient le même
-- numéro, et la contrainte d'unicité rejetait la seconde : le vendeur recevait
-- « contrainte de données violée » devant son client. Mesuré sur l'API, dix
-- ventes lancées ensemble n'en laissaient passer qu'une, et deux ventes
-- séparées de 30 ms suffisaient déjà à provoquer l'échec.
--
-- Une ligne par préfixe et par jour, incrémentée par un « insert … on conflict
-- do update … returning », qui est atomique : deux transactions concurrentes
-- se sérialisent sur la ligne et obtiennent deux rangs distincts, sans relire
-- quoi que ce soit et sans jamais échouer.

CREATE TABLE public.compteur_journalier (
    prefixe character varying(10) NOT NULL,
    jour date NOT NULL,
    dernier integer NOT NULL,

    CONSTRAINT compteur_journalier_pkey PRIMARY KEY (prefixe, jour),
    CONSTRAINT compteur_journalier_dernier_check CHECK (dernier > 0)
);

-- --- Reprise de l'existant -------------------------------------------------
-- Sans cet amorçage, la prochaine opération d'un jour déjà entamé repartirait
-- du rang 1 et heurterait un numéro déjà attribué. On reprend le plus grand
-- rang réellement émis, et non le nombre de lignes : un trou dans la série,
-- qu'une reprise sur erreur aurait pu laisser, ne doit pas faire reculer le
-- compteur.
INSERT INTO public.compteur_journalier (prefixe, jour, dernier)
SELECT 'ACH', a.date_achat::date, max(split_part(a.numero, '-', 3)::int)
FROM public.achat a
GROUP BY a.date_achat::date;

INSERT INTO public.compteur_journalier (prefixe, jour, dernier)
SELECT 'LIV', l.date_livraison::date, max(split_part(l.numero, '-', 3)::int)
FROM public.livraison l
GROUP BY l.date_livraison::date;
