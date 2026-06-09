# Yémi Macarons — Site de prise de commande

> *Le goût d'un continent dans un nuage*

Site vitrine et prise de commande de **Yémi Macarons**, maison artisanale parisienne de macarons aux saveurs africaines et caribéennes. Le site présente la marque, ses 5 saveurs signature et ses 3 coffrets, et collecte des commandes détaillées **sans paiement en ligne** : chaque commande est envoyée par email à la marque, qui recontacte ensuite le client pour le paiement et la livraison.

## Sommaire

1. [Architecture](#architecture)
2. [Installation locale](#installation-locale)
3. [Configuration des emails (SMTP)](#configuration-des-emails-smtp)
4. [Déploiement sur Hostinger](#déploiement-sur-hostinger)
5. [Fonctionnement du tunnel de commande](#fonctionnement-du-tunnel-de-commande)
6. [Notes pour la suite](#notes-pour-la-suite)

## Architecture

- **Front-end** : HTML / CSS / JavaScript vanilla (modules ES), mobile-first, sans framework. Séparation stricte : structure dans le HTML, mise en forme dans le CSS (aucun style en ligne), interactivité dans le JS.
- **Back-end** : Node.js + Express. Il sert les fichiers statiques de `public/` et expose `POST /api/commande`, qui revalide la commande côté serveur puis l'envoie par email via Nodemailer.

```
yemi_macarons/
├─ public/
│  ├─ index.html              Accueil
│  ├─ saveurs.html            Les 5 saveurs (sections ancrées, SEO)
│  ├─ coffrets.html           Liste des coffrets
│  ├─ coffrets/               Pages produit (6, 8, 16 macarons)
│  ├─ histoire.html           Notre histoire
│  ├─ panier.html             Panier (localStorage)
│  ├─ commande.html           Tunnel de commande en 3 étapes
│  ├─ css/                    variables.css (palette, typos) + styles.css
│  ├─ js/                     data.js, cart.js, ui.js, main.js, panier.js, commande.js
│  ├─ assets/img/             Images optimisées (WebP + JPG/PNG)
│  ├─ sitemap.xml, robots.txt
├─ server.js                  Express : statique + POST /api/commande
├─ mailer.js                  Nodemailer : email marque + confirmation client
├─ package.json
├─ .env.example               Modèle de configuration (sans secrets)
└─ .gitignore                 node_modules et .env exclus
```

## Installation locale

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
git clone https://github.com/ananabrc03/yemi_macarons.git
cd yemi_macarons
npm install
cp .env.example .env    # puis remplir les valeurs SMTP (facultatif en local)
npm start
```

Le site est alors disponible sur [http://localhost:3000](http://localhost:3000).

Sans configuration SMTP, le serveur fonctionne en **mode développement** : les commandes sont affichées dans la console au lieu d'être envoyées par email. C'est pratique pour tester le tunnel de bout en bout.

## Configuration des emails (SMTP)

Les commandes sont transmises par email via Nodemailer. Renseignez ces variables (fichier `.env` en local, panneau Hostinger en production) :

| Variable | Description | Exemple |
|---|---|---|
| `SMTP_HOST` | Serveur SMTP | `smtp.mail.yahoo.com` |
| `SMTP_PORT` | Port (465 = SSL) | `465` |
| `SMTP_SECURE` | SSL activé | `true` |
| `SMTP_USER` | Identifiant de la boîte d'envoi | `adresse@exemple.com` |
| `SMTP_PASS` | Mot de passe **d'application** | — |
| `SMTP_FROM` | Adresse expéditrice affichée | `adresse@exemple.com` |
| `ORDER_EMAIL` | Boîte qui reçoit les commandes | `yemi_macarons@yahoo.com` |

Avec une boîte Yahoo, créez un « mot de passe d'application » : Compte Yahoo → Sécurité → Générer un mot de passe d'application. N'utilisez jamais le mot de passe principal du compte, et ne commitez jamais le fichier `.env`.

Pour chaque commande, deux emails partent : le récapitulatif complet à la marque (avec « répondre à » vers le client) et une confirmation au client.

## Déploiement sur Hostinger

1. Pousser le projet sur le repository GitHub `yemi_macarons` (le `.gitignore` exclut déjà `node_modules` et `.env`).
2. Dans le panneau Hostinger : créer un site → **« Application web Node.js »** → déployer depuis GitHub (sélectionner le repository et la branche `main`).
3. Définir la commande de démarrage : `node server.js` (le port est fourni automatiquement par Hostinger via `process.env.PORT`).
4. Configurer les **variables d'environnement SMTP** (tableau ci-dessus) dans le panneau Hostinger.
5. Vérifier que le site s'affiche et faire un **test d'envoi réel** : passer une commande de test et contrôler la réception de l'email sur `ORDER_EMAIL` ainsi que la confirmation client.
6. Brancher le nom de domaine, activer le HTTPS, puis tester sur mobile et desktop.

Si le domaine définitif diffère de `www.yemimacarons.fr`, remplacer ce domaine dans `public/sitemap.xml`, `public/robots.txt` et les balises `canonical` / Open Graph des pages HTML.

## Fonctionnement du tunnel de commande

1. **Pages produit** : le client choisit un type de coffret et une quantité (pas la composition). L'ajout au panier incrémente le compteur du header ; le panier persiste en `localStorage`.
2. **Panier** : quantités modifiables, suppression, sous-total indicatif, bouton « Commander ».
3. **Étape 1 — Composition** : pour chaque boîte, répartition des 5 saveurs avec compteur live « X / N sélectionnés ». Le total doit être exactement égal à la taille du coffret (dépassement bloqué, bouton désactivé sinon). Si plusieurs boîtes identiques : case « Même composition pour mes autres boîtes » (cochée = duplication, décochée = saisie boîte par boîte).
4. **Étape 2 — Coordonnées** : nom, prénom, email, téléphone obligatoires et validés. Choix « point de vente » ou « livraison à domicile » (adresse alors obligatoire).
5. **Étape 3 — Confirmation** : commentaire facultatif, récapitulatif, envoi. Le serveur revalide tout, envoie les emails et le client voit le message de remerciement.

## Notes pour la suite

- **Visuel du coffret 16** : pas de photo dédiée fournie ; le fichier `coffret-16` est utilisé. À remplacer si une photo spécifique est produite.
- **Charte graphique** : palette et typographies relevées sur les visuels fournis (cf. `public/css/variables.css`) ; à affiner si la charte Canva définitive diffère.
- **Bar à macarons** : simple bloc + lien de contact en v1 ; une page dédiée est recommandée en v2 (fort potentiel B2B).
- **Mentions légales / CGV / RGPD** : textes à fournir par la marque, à intégrer dans une page dédiée.
- **Option** : journalisation des commandes dans un Google Sheet en plus de l'email, si un suivi est souhaité.
