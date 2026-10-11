# Rapport de réalisation

Logiciel de gestion d'une boutique de produits alimentaires.

En regard du cahier des charges `backend/sujet_gestion_boutique.pdf`.


## a. Liste des fonctionnalités réalisées


### Fonctionnalités du cahier des charges

1. **Ajouter un utilisateur** : nom, prénom, matricule, sexe, date de naissance,
   identifiant et mot de passe. *Écran Utilisateurs.*

2. **Enregistrer les achats d'un client**, un achat pouvant porter sur plusieurs
   produits. *Écran Nouvelle vente.*

3. **Enregistrer les livraisons de grossistes**, une livraison portant sur
   plusieurs produits. *Écran Nouvelle livraison.*

4. **Afficher l'historique des achats et des livraisons**, filtrable par
   période. *Écrans Ventes et Livraisons.*

5. **Se connecter à l'application.** *Écran Connexion.*

6. **Imprimer le ticket de caisse**, en PDF au gabarit 58 mm, ouvert prêt à
   imprimer.

7. **Rechercher un produit par le nom**, depuis le catalogue.


### Fonctionnalités ajoutées

* **Catalogue produits**

  Création, modification, retrait du catalogue. Prix d'achat et de vente, unité
  de mesure, marge.

* **Gestion du stock**

  Décrément à la vente, incrément à la livraison, refus de vendre au-delà du
  disponible. Seuil d'alerte et écran des produits à réapprovisionner.

* **Journal des mouvements de stock**

  Type, auteur, date et opération d'origine de chaque variation.

* **Inventaire physique**

  Saisie de la quantité comptée, écart calculé et justifié par un motif : casse,
  péremption, vol, erreur de saisie, don.

* **Moyens de paiement**

  Espèces, Orange Money, Moov Money, carte.

* **Annulation d'une vente**

  Avec motif, retour en stock au choix et auteur.

* **Tableau de bord**

  Chiffre d'affaires, marge, ventes par jour, ventes par moyen de paiement,
  meilleures ventes, valorisation du stock et alertes, sur la période choisie.

* **Export CSV des ventes** pour la comptabilité.

* **Deux rôles**, gérant et vendeur, avec droits distincts.

* **Sécurité des comptes**

  Jeton révocable, blocage après cinq tentatives échouées, réinitialisation d'un
  mot de passe perdu par le gérant, déconnexion de tous les appareils.

* **Exploitation**

  Migrations de schéma versionnées, sauvegarde quotidienne de la base avec
  rotation.


## b. Liste des fonctionnalités demandées non réalisées

Aucune.


## c. Architecture de réalisation

Serveur **Spring Boot 4.1** en Java 17, organisé en couches : contrôleurs REST,
services portant les règles métier, dépôts Spring Data, entités JPA.

Base **PostgreSQL 18**.

Interface **Next.js** consommant l'API REST.


### Diagramme de classe

![Diagramme de classe](diagramme-de-classe.png)


### Modèle conceptuel des données

![Modèle conceptuel des données](modele-conceptuel-donnees.png)


## d. IHM réalisée avec tests des différentes fonctionnalités


### Écrans

**Accessibles à tout utilisateur connecté**

* `/login`

  Connexion.

* `/dashboard/produits`

  Catalogue, recherche et alertes de stock. Le gérant y crée, modifie,
  inventorie et retire un produit.

* `/dashboard/ventes`

  Historique filtrable et ticket de caisse. Le gérant y annule une vente et
  exporte la période.

* `/dashboard/ventes/nouvelle`

  Saisie d'une vente à plusieurs produits.

* `/dashboard/livraisons`

  Historique des livraisons.

* `/dashboard/parametres`

  Fiche du compte connecté, changement de mot de passe.


**Réservés au gérant**

* `/dashboard`

  Tableau de bord et sélecteur de période.

* `/dashboard/livraisons/nouvelle`

  Saisie d'une livraison à plusieurs produits.

* `/dashboard/utilisateurs`

  Personnel : création, modification, activation et réinitialisation de mot de
  passe.


### Tests

**323 cas de test.**

148 côté serveur, répartis en 18 classes.

175 côté interface, répartis en 20 fichiers.


**Fonctionnalités couvertes**

* Connexion, révocation des jetons, blocage après tentatives échouées.

* Droits de chaque rôle.

* Saisie d'une vente et d'une livraison, refus de vendre à découvert.

* Retour en arrière d'une vente partiellement enregistrée.

* Annulation et retour en stock.

* Inventaire et journal des mouvements.

* Numérotation sous appels simultanés.

* Catalogue et recherche, ticket de caisse.

* Tableau de bord, export comptable.

* Gestion du personnel.
