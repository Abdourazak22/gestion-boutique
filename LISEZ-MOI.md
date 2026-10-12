# Gestion de boutique

[![CI](https://github.com/Abdourazak22/gestion-boutique/actions/workflows/ci.yml/badge.svg)](https://github.com/Abdourazak22/gestion-boutique/actions/workflows/ci.yml)

Logiciel de gestion d'une boutique de produits alimentaires : ventes,
livraisons, stock, personnel et tableau de bord.

Réalisé d'après le cahier des charges `backend/sujet_gestion_boutique.pdf`.
Le rapport demandé se trouve dans **[RAPPORT.pdf](RAPPORT.pdf)**,
dont la source est [RAPPORT.md](RAPPORT.md).


## Ce qu'il contient

**`backend/`** — API REST en Java 17 et Spring Boot 4.1, base PostgreSQL 18.

**`frontend/`** — Interface Next.js et TypeScript, utilisable sur téléphone.

**`RAPPORT.md`** — Fonctionnalités réalisées, architecture, diagramme de
classe et modèle conceptuel des données.

**`backend/schema.sql`** — Le DDL des huit tables d'un seul tenant.


## Lancer l'application

Il faut Java 17 ou plus récent, Node 22 et PostgreSQL.

Ces instructions ont été vérifiées sur une base vierge : création du compte
et de la base, migrations appliquées, puis les deux serveurs interrogés.


### 1. La base

```sh
sudo -u postgres psql -c "CREATE USER boutique WITH PASSWORD 'boutique';"
sudo -u postgres createdb -O boutique boutique
```

Le `-O boutique` n'est pas facultatif : depuis PostgreSQL 15, un simple
`GRANT ALL ON DATABASE` ne suffit plus à écrire dans le schéma `public`. Sans
lui, l'application démarre puis échoue sur un refus de permission.

Le schéma se crée tout seul au premier démarrage : les migrations sont
embarquées dans l'application.


### 2. L'API

```sh
cd backend
./mvnw clean package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

Elle écoute sur **8080**. La documentation interactive est servie sur
<http://localhost:8080/swagger-ui.html>.

Un compte gérant est créé au premier lancement : `gerant` / `gerant123`.


### 3. L'interface

```sh
cd frontend

cat > .env <<'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_API_TIMEOUT=10000
API_URL=http://localhost:8080/api
EOF

npm ci
npm run build && npm run start
```

Le fichier `.env.example` liste les variables sans leurs valeurs : le copier
tel quel fait échouer la construction, l'application refusant de démarrer sans
adresse d'API plutôt que d'émettre des requêtes vers nulle part.

Elle écoute sur **3000**. Ouvrir <http://localhost:3000>.

L'adresse de l'API est inscrite dans le bundle à la construction : la changer
impose de reconstruire, pas seulement de relancer.


## Ce que le projet démontre

**323 tests**, dont 148 côté serveur et 175 côté interface, exécutés à chaque
poussée par l'intégration continue.

**Un journal des mouvements de stock** où chaque variation laisse une trace
avec son auteur, sa date et son motif. La somme des variations d'un produit
égale son stock : c'est un invariant, et il est vérifié par les tests.

**La numérotation des ventes sous concurrence.** Le comptage initial faisait
échouer neuf ventes simultanées sur dix ; la mesure, la correction par un
incrément atomique et le test qui la garde sont dans l'historique
(`fix: deux ventes simultanées ne se heurtent plus sur leur numéro`).

**Des migrations de schéma versionnées**, dans `backend/src/main/resources/db/migration`.
Hibernate ne modifie jamais la base : il valide qu'elle correspond aux entités.

**Une sauvegarde quotidienne de la base**, avec rotation, contrôle d'intégrité
et restauration testée (`backend/scripts/`).

**Des droits appliqués côté serveur** et non masqués dans l'interface : un
vendeur qui forcerait une route réservée au gérant reçoit un 403.


## Historique

Le projet s'est construit en une trentaine de commits dont les messages
expliquent les décisions, pas seulement les changements. `git log` se lit.
