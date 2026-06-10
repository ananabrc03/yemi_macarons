/**
 * mailer.js — Envoi des commandes par email via Nodemailer (SMTP).
 *
 * Deux emails sont envoyés pour chaque commande :
 *   1. Le récapitulatif complet à la marque (ORDER_EMAIL).
 *   2. Une confirmation au client (rassurant et professionnel).
 *
 * Les identifiants SMTP viennent des variables d'environnement
 * (cf. .env.example). AUCUN secret ne doit être commité.
 *
 * Mode développement : si SMTP_HOST n'est pas défini, la commande est
 * simplement journalisée dans la console (pas d'envoi réel).
 */

const nodemailer = require('nodemailer');

const SAVEURS = {
  hibiscus: 'Hibiscus – Framboise',
  mangue: 'Mangue – Gingembre – Citron vert',
  cacao: 'Cacao – Piment végétarien – Piment d’Espelette',
  baobab: 'Baobab – Fruit de la Passion',
  goyave: 'Goyave – Noix de coco',
};

/** Crée le transporteur SMTP (ou null si non configuré → mode dev). */
function creerTransporteur() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false', // SSL par défaut (port 465)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/** Échappe les caractères HTML d'une saisie client (anti-injection). */
function echapper(texte) {
  return String(texte || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Décrit une composition en texte lisible (« 2 × Hibiscus, 3 × Mangue »). */
function decrireComposition(composition) {
  return Object.entries(composition || {})
    .filter(([, n]) => Number(n) > 0)
    .map(([id, n]) => `${n} × ${SAVEURS[id] || id}`)
    .join(', ');
}

/** Construit le récapitulatif HTML commun aux deux emails. */
function construireRecapitulatif(commande) {
  const lignesCoffrets = commande.items
    .map((item) => {
      const boites = item.compositions
        .map((compo, i) => `<li>Boîte ${i + 1} : ${decrireComposition(compo)}</li>`)
        .join('');
      return `
        <p><strong>${echapper(item.nom)} × ${item.quantite}</strong>
        (${item.prixUnitaire} € l'unité)</p>
        <ul>${boites}</ul>`;
    })
    .join('');

  const livraison =
    commande.livraison.mode === 'domicile'
      ? `Livraison à domicile — ${echapper(commande.livraison.adresse)},
         ${echapper(commande.livraison.codePostal)} ${echapper(commande.livraison.ville)}`
      : 'Récupération au point de vente';

  const dateCommande = new Date(commande.date || commande.recueAt).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });

  return `
    <h2>Coffrets commandés</h2>
    ${lignesCoffrets}
    <h2>Client</h2>
    <p>
      ${echapper(commande.client.prenom)} ${echapper(commande.client.nom)}<br>
      Email : ${echapper(commande.client.email)}<br>
      Téléphone : ${echapper(commande.client.telephone)}
    </p>
    <h2>Livraison</h2>
    <p>${livraison}</p>
    ${
      commande.commentaire
        ? `<h2>Commentaire</h2><p>${echapper(commande.commentaire)}</p>`
        : ''
    }
    <h2>Total indicatif</h2>
    <p><strong>${commande.total} €</strong></p>
    <p><em>Commande reçue le ${dateCommande}.</em></p>`;
}

/**
 * Envoie le récapitulatif à la marque + la confirmation au client.
 * Lève une erreur si l'envoi à la marque échoue (la confirmation client
 * est envoyée en « best effort » : son échec ne bloque pas la commande).
 */
async function envoyerCommande(commande) {
  const transporteur = creerTransporteur();
  const recapitulatif = construireRecapitulatif(commande);
  const destinataire = process.env.ORDER_EMAIL || 'anaisbrochec@yahoo.fr';
  const expediteur = process.env.SMTP_FROM || process.env.SMTP_USER;

  // Mode développement : pas de SMTP configuré, on journalise simplement.
  if (!transporteur) {
    console.log('=== [DEV] Nouvelle commande (SMTP non configuré) ===');
    console.log(JSON.stringify(commande, null, 2));
    return;
  }

  // 1. Email à la marque (avec reply-to vers le client).
  await transporteur.sendMail({
    from: `"Site Yémi Macarons" <${expediteur}>`,
    to: destinataire,
    replyTo: commande.client.email,
    subject: `Nouvelle commande — ${commande.client.prenom} ${commande.client.nom} (${commande.total} €)`,
    html: `<h1>Nouvelle commande reçue</h1>${recapitulatif}`,
  });

  // 2. Confirmation au client (best effort).
  try {
    await transporteur.sendMail({
      from: `"Yémi Macarons" <${expediteur}>`,
      to: commande.client.email,
      subject: 'Votre commande Yémi Macarons est bien reçue',
      html: `
        <h1>Merci pour votre confiance !</h1>
        <p>
          Nous avons bien reçu votre commande. Nous vous contacterons dans
          les plus brefs délais pour le paiement et la livraison.
        </p>
        ${recapitulatif}
        <p>
          À très vite,<br>
          <strong>Yémi Macarons</strong> — Le goût d'un continent dans un nuage<br>
          07 69 03 13 19 · Paris
        </p>`,
    });
  } catch (erreur) {
    console.warn('[mailer] Confirmation client non envoyée :', erreur.message);
  }
}

module.exports = { envoyerCommande };
