/**
 * server.js — Serveur Express de Yémi Macarons.
 *
 * Rôles :
 *   1. Servir les fichiers statiques du dossier public/ (site vitrine).
 *   2. Exposer la route POST /api/commande qui reçoit le récapitulatif
 *      de commande et le transmet par email via mailer.js.
 *
 * Déploiement Hostinger (« Application web Node.js ») :
 *   - commande de démarrage : node server.js
 *   - le port est fourni par la plateforme via process.env.PORT
 *   - variables SMTP à configurer dans le panneau (cf. .env.example)
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const { envoyerCommande } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

/* --------------------------------------------------------------------------
   Middlewares
   -------------------------------------------------------------------------- */

app.use(express.json({ limit: '100kb' }));

/* --------------------------------------------------------------------------
   URLs propres (SEO) : chaque page a sa route explicite.
   Déclarées AVANT express.static pour que « /coffrets » serve la page
   coffrets.html et non une redirection vers le dossier coffrets/.
   -------------------------------------------------------------------------- */

const PAGES = {
  '/': 'index.html',
  '/saveurs': 'saveurs.html',
  '/coffrets': 'coffrets.html',
  '/coffrets/6-macarons': 'coffrets/6-macarons.html',
  '/coffrets/8-macarons': 'coffrets/8-macarons.html',
  '/coffrets/16-macarons': 'coffrets/16-macarons.html',
  '/histoire': 'histoire.html',
  '/panier': 'panier.html',
  '/commande': 'commande.html',
};

Object.entries(PAGES).forEach(([route, fichier]) => {
  app.get(route, (req, res) => res.sendFile(path.join(PUBLIC, fichier)));
});

// Fichiers statiques (css, js, images, favicon…).
app.use(express.static(PUBLIC, { extensions: ['html'], redirect: false }));

/* --------------------------------------------------------------------------
   API — réception des commandes
   -------------------------------------------------------------------------- */

/** Tailles et prix officiels, pour revalider la commande côté serveur. */
const CATALOGUE = {
  6: { taille: 6, prix: 20, nom: 'Coffret 6 macarons' },
  8: { taille: 8, prix: 25, nom: 'Coffret 8 macarons' },
  16: { taille: 16, prix: 45, nom: 'Coffret 16 macarons' },
};

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valide le corps de la requête. Retourne une liste de problèmes
 * (vide si la commande est valide). On ne fait JAMAIS confiance au client.
 */
function validerCommande(corps) {
  const problemes = [];

  if (!corps || typeof corps !== 'object') return ['Corps de requête manquant.'];

  // Items + compositions
  if (!Array.isArray(corps.items) || corps.items.length === 0) {
    problemes.push('La commande ne contient aucun coffret.');
  } else {
    corps.items.forEach((item, i) => {
      const ref = CATALOGUE[item.type];
      if (!ref) {
        problemes.push(`Item ${i + 1} : type de coffret inconnu.`);
        return;
      }
      if (!Number.isInteger(item.quantite) || item.quantite < 1 || item.quantite > 50) {
        problemes.push(`Item ${i + 1} : quantité invalide.`);
        return;
      }
      if (!Array.isArray(item.compositions) || item.compositions.length !== item.quantite) {
        problemes.push(`Item ${i + 1} : compositions manquantes.`);
        return;
      }
      item.compositions.forEach((compo, j) => {
        const total = Object.values(compo || {}).reduce(
          (somme, n) => somme + (Number(n) || 0),
          0
        );
        if (total !== ref.taille) {
          problemes.push(
            `Item ${i + 1}, boîte ${j + 1} : ${total} macarons au lieu de ${ref.taille}.`
          );
        }
      });
    });
  }

  // Client
  const client = corps.client || {};
  if (!client.nom || !client.nom.trim()) problemes.push('Nom manquant.');
  if (!client.prenom || !client.prenom.trim()) problemes.push('Prénom manquant.');
  if (!REGEX_EMAIL.test(client.email || '')) problemes.push('Email invalide.');
  if (!client.telephone || client.telephone.replace(/\D/g, '').length < 10) {
    problemes.push('Téléphone invalide.');
  }

  // Livraison
  const livraison = corps.livraison || {};
  if (!['domicile', 'point-de-vente'].includes(livraison.mode)) {
    problemes.push('Mode de livraison invalide.');
  } else if (livraison.mode === 'domicile') {
    if (!livraison.adresse || !livraison.adresse.trim()) problemes.push('Adresse manquante.');
    if (!/^\d{5}$/.test(livraison.codePostal || '')) problemes.push('Code postal invalide.');
    if (!livraison.ville || !livraison.ville.trim()) problemes.push('Ville manquante.');
  }

  return problemes;
}

app.post('/api/commande', async (req, res) => {
  const problemes = validerCommande(req.body);

  if (problemes.length) {
    return res.status(400).json({ ok: false, erreurs: problemes });
  }

  // Total recalculé côté serveur à partir du catalogue officiel.
  const total = req.body.items.reduce(
    (somme, item) => somme + CATALOGUE[item.type].prix * item.quantite,
    0
  );

  const commande = { ...req.body, total, recueAt: new Date().toISOString() };

  try {
    await envoyerCommande(commande);
    res.json({ ok: true });
  } catch (erreur) {
    console.error('[commande] Échec de l’envoi email :', erreur.message);
    res.status(502).json({
      ok: false,
      erreurs: ['L’envoi de la commande a échoué. Merci de réessayer.'],
    });
  }
});

/* --------------------------------------------------------------------------
   404 — page non trouvée (on renvoie l'accueil pour rester simple)
   -------------------------------------------------------------------------- */

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Yémi Macarons en ligne sur le port ${PORT}`);
});
