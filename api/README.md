# Tester l'API

Prerequis : l'application tournante (`./mvnw spring-boot:run`) et Postgres demarre.

## 1. Swagger UI (le plus rapide)

<http://localhost:8080/swagger-ui.html>

1. `POST /api/auth/connexion` -> *Try it out* avec `gerant` / `gerant123`
2. Copier la valeur `jeton` de la reponse
3. Bouton **Authorize** en haut a droite, coller le jeton
4. Les routes protegees sont maintenant appelables

Specification brute : <http://localhost:8080/v3/api-docs>

## 2. Postman / Insomnia / Bruno

Importer `boutique.postman_collection.json`.

Quatre dossiers : **Authentification**, **Produits**, **Achats et livraisons** et
**Utilisateurs**.

Lancer d'abord **Authentification > Connexion** : son script de test range le JWT
dans la variable de collection `{{jeton}}`, que les autres requetes reutilisent via
l'auth Bearer. Dans **Produits**, *Creer un produit* range l'id dans `{{produitId}}`,
utilise par les requetes de detail, modification et suppression — donc lancer le
dossier dans l'ordre. Variable `baseUrl` a adapter si besoin.

En ligne de commande (collection entiere + assertions) :

```bash
npx newman run api/boutique.postman_collection.json
```

Autre option si tu preferes partir de la spec : dans Postman, *Import > Link* avec
`http://localhost:8080/v3/api-docs` genere la collection automatiquement — mais sans
les scripts qui propagent le jeton.

## Ticket de caisse

`GET /api/achats/{id}/ticket` renvoie un PDF (`application/pdf`, `Content-Disposition:
inline`) au gabarit d'une imprimante thermique 58 mm : le navigateur l'ouvre dans sa
visionneuse, pret a imprimer. Depuis Swagger UI, cliquer sur *Download file* dans la
reponse. Depuis Postman, l'onglet de reponse l'affiche directement.

En ligne de commande :

```bash
curl -s localhost:8080/api/achats/1/ticket -H "Authorization: Bearer $JETON" -o ticket.pdf
xdg-open ticket.pdf
```

## 3. Client HTTP en fichier `.http`

Deux variantes, car les deux outils n'ont pas la meme syntaxe :

| Fichier | Outil | Mecanisme du jeton |
|---|---|---|
| `auth.http` | IntelliJ IDEA / WebStorm (client HTTP integre) | script `> {% ... %}` qui ecrit `client.global.set("jeton", ...)` |
| `produits.http` | idem | idem, plus `{{produitId}}` recupere a la creation |
| `achats-livraisons.http` | idem | idem, plus `{{rizId}}`, `{{sucreId}}`, `{{achatId}}`, `{{livraisonId}}` |
| `statistiques.http` | idem | idem ; agregats du tableau de bord, role GERANT |
| `utilisateurs.http` | idem | idem, plus `{{utilisateurId}}` et `{{jetonVendeuse}}` |
| `auth.vscode.http` | extension VS Code *REST Client* (`humao.rest-client`) | `{{connexion.response.body.$.jeton}}` |

Pour IntelliJ, selectionner l'environnement **local** (defini dans
`http-client.env.json`) dans la liste deroulante en haut du fichier, puis executer
la requete *Connexion* avant les autres.
