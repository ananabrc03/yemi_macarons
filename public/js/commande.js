/**
 * commande.js — Tunnel de commande en 3 étapes (cf. brief, section 7) :
 *   1. Composition des coffrets (saveurs par boîte, total exact imposé)
 *   2. Informations client + mode de livraison
 *   3. Commentaire libre + récapitulatif + envoi à la marque
 *
 * Aucun paiement en ligne : l'étape 3 envoie le récapitulatif à
 * POST /api/commande, qui le transmet par email à la marque.
 */

import { initialiserUI } from './ui.js';
import {
  lirePanier,
  sauverPanier,
  viderPanier,
  ajusterCompositions,
  totalComposition,
  boiteComplete,
  validerCompositions,
  calculerTotal,
} from './cart.js';
import { COFFRETS, SAVEURS, nomSaveur, formaterPrix } from './data.js';

initialiserUI();

/* --------------------------------------------------------------------------
   État local du tunnel
   -------------------------------------------------------------------------- */

let panier = lirePanier();

/** Cases « même composition » : { [type]: true/false } (cochées par défaut). */
const memeCompo = {};
panier.forEach((item) => {
  if (item.quantite >= 2) memeCompo[item.type] = true;
});

const panneaux = {
  1: document.getElementById('etape-1'),
  2: document.getElementById('etape-2'),
  3: document.getElementById('etape-3'),
};
const indicateurs = Array.from(document.querySelectorAll('.etapes__item'));
const panneauConfirmation = document.getElementById('confirmation');

/* Panier vide : on invite à composer un panier au lieu d'afficher le tunnel. */
if (!panier.length) {
  document.getElementById('tunnel').innerHTML = `
    <div class="panier-vide">
      <h2>Votre panier est vide</h2>
      <p>Ajoutez d'abord un coffret pour passer commande.</p>
      <a class="btn btn--principal" href="/coffrets">Découvrir les coffrets</a>
    </div>`;
}

/* --------------------------------------------------------------------------
   Navigation entre étapes
   -------------------------------------------------------------------------- */

function allerEtape(numero) {
  Object.entries(panneaux).forEach(([n, panneau]) => {
    panneau.hidden = Number(n) !== numero;
  });

  indicateurs.forEach((item, index) => {
    item.classList.toggle('etapes__item--active', index + 1 === numero);
    item.classList.toggle('etapes__item--faite', index + 1 < numero);
    if (index + 1 === numero) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   ÉTAPE 1 — Composition des coffrets
   ========================================================================== */

const conteneurBoites = document.getElementById('composition');
const boutonContinuer = document.getElementById('btn-etape-1');

/** Rend tous les blocs de composition (une section par type de coffret). */
function afficherComposition() {
  panier.forEach((item) => {
    item.compositions = ajusterCompositions(item);
  });

  const sections = panier
    .map((item) => {
      const coffret = COFFRETS[item.type];
      const duplique = item.quantite >= 2 && memeCompo[item.type];

      // Case « même composition » uniquement si 2+ boîtes identiques.
      const caseDuplication =
        item.quantite >= 2
          ? `
        <label class="meme-compo">
          <input type="checkbox" data-meme-compo="${item.type}"
                 ${memeCompo[item.type] ? 'checked' : ''}>
          <span>
            <strong>Même composition pour mes autres boîtes.</strong><br>
            La répartition de la boîte 1 sera appliquée à vos
            ${item.quantite} coffrets « ${coffret.nom} ».
          </span>
        </label>`
          : '';

      // Si la case est cochée, on n'affiche que la boîte 1.
      const nbBoitesAffichees = duplique ? 1 : item.quantite;
      const boites = Array.from({ length: nbBoitesAffichees }, (_, index) =>
        rendreBoite(item, index)
      ).join('');

      return `
      <section aria-label="Composition — ${coffret.nom}">
        <h2>${coffret.nom}${item.quantite > 1 ? ` × ${item.quantite}` : ''}</h2>
        ${caseDuplication}
        ${boites}
      </section>`;
    })
    .join('');

  conteneurBoites.innerHTML = sections;
  rafraichirEtape1();
}

/** Rend le bloc de saisie d'une boîte (5 saveurs + compteur live). */
function rendreBoite(item, indexBoite) {
  const composition = item.compositions[indexBoite] || {};
  const total = totalComposition(composition);
  const complet = total === item.taille;

  const lignes = SAVEURS.map((saveur) => {
    const valeur = Number(composition[saveur.id]) || 0;
    return `
    <li class="boite__saveur">
      <span class="boite__saveur-nom">${saveur.nom}</span>
      <div class="stepper" role="group" aria-label="${saveur.nom}">
        <button class="stepper__btn" type="button"
                data-saveur="${saveur.id}" data-delta="-1"
                aria-label="Retirer un macaron ${saveur.nom}"
                ${valeur <= 0 ? 'disabled' : ''}>−</button>
        <input class="stepper__valeur" type="number" inputmode="numeric"
               data-saveur="${saveur.id}" value="${valeur}"
               min="0" max="${item.taille}"
               aria-label="Nombre de macarons ${saveur.nom}">
        <button class="stepper__btn" type="button"
                data-saveur="${saveur.id}" data-delta="1"
                aria-label="Ajouter un macaron ${saveur.nom}"
                ${complet ? 'disabled' : ''}>+</button>
      </div>
    </li>`;
  }).join('');

  return `
  <div class="boite" data-type="${item.type}" data-boite="${indexBoite}">
    <div class="boite__entete">
      <h3 class="boite__titre">Boîte ${indexBoite + 1}</h3>
      <span class="boite__compteur ${complet ? 'boite__compteur--complet' : ''}"
            aria-live="polite">
        ${total} / ${item.taille} sélectionnés${complet ? ' ✓' : ''}
      </span>
    </div>
    <ul class="boite__saveurs">${lignes}</ul>
  </div>`;
}

/**
 * Applique une saisie sur une saveur d'une boîte, en respectant la règle :
 * impossible de dépasser la taille du coffret.
 */
function saisirSaveur(type, indexBoite, saveurId, valeurDemandee) {
  const item = panier.find((i) => i.type === type);
  if (!item) return;

  const composition = { ...(item.compositions[indexBoite] || {}) };
  const actuelle = Number(composition[saveurId]) || 0;
  const autres = totalComposition(composition) - actuelle;

  // Blocage : la nouvelle valeur ne peut pas faire dépasser la taille.
  const maximumAutorise = item.taille - autres;
  composition[saveurId] = Math.max(0, Math.min(maximumAutorise, valeurDemandee));

  item.compositions[indexBoite] = composition;

  // Case cochée : on duplique la composition de la boîte 1 sur les autres.
  if (memeCompo[item.type] && indexBoite === 0) {
    item.compositions = item.compositions.map(() => ({ ...composition }));
  }

  sauverPanier(panier);
}

/** Met à jour le bouton « Continuer » selon la complétude de toutes les boîtes. */
function rafraichirEtape1() {
  const { valide } = validerCompositions(panier);
  boutonContinuer.disabled = !valide;
}

/* Clics sur les steppers (+ / −) de l'étape 1. */
conteneurBoites.addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button[data-saveur]');
  if (!bouton) return;

  const boite = bouton.closest('.boite');
  const champ = boite.querySelector(`input[data-saveur="${bouton.dataset.saveur}"]`);
  const valeur = (parseInt(champ.value, 10) || 0) + Number(bouton.dataset.delta);

  saisirSaveur(boite.dataset.type, Number(boite.dataset.boite), bouton.dataset.saveur, valeur);
  afficherComposition();
});

/* Saisie directe dans un champ nombre de l'étape 1. */
conteneurBoites.addEventListener('change', (evenement) => {
  const champ = evenement.target.closest('input[data-saveur]');

  if (champ) {
    const boite = champ.closest('.boite');
    saisirSaveur(
      boite.dataset.type,
      Number(boite.dataset.boite),
      champ.dataset.saveur,
      parseInt(champ.value, 10) || 0
    );
    afficherComposition();
    return;
  }

  // Case « même composition » cochée / décochée.
  const caseCochee = evenement.target.closest('input[data-meme-compo]');
  if (caseCochee) {
    const type = caseCochee.dataset.memeCompo;
    memeCompo[type] = caseCochee.checked;

    if (caseCochee.checked) {
      // On duplique immédiatement la boîte 1 sur toutes les boîtes.
      const item = panier.find((i) => i.type === type);
      const reference = { ...(item.compositions[0] || {}) };
      item.compositions = item.compositions.map(() => ({ ...reference }));
      sauverPanier(panier);
    }

    afficherComposition();
  }
});

boutonContinuer.addEventListener('click', () => {
  if (validerCompositions(panier).valide) allerEtape(2);
});

/* ==========================================================================
   ÉTAPE 2 — Informations client + livraison
   ========================================================================== */

const formulaireClient = document.getElementById('formulaire-client');
const blocAdresse = document.getElementById('bloc-adresse');
const boutonSuivant = document.getElementById('btn-etape-2');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_TELEPHONE = /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/;

/** Définition des contrôles de validation par champ. */
const VALIDATEURS = {
  nom: (v) => v.trim().length >= 2 || 'Veuillez saisir votre nom.',
  prenom: (v) => v.trim().length >= 2 || 'Veuillez saisir votre prénom.',
  email: (v) => REGEX_EMAIL.test(v.trim()) || 'Adresse email invalide (ex. nom@exemple.fr).',
  telephone: (v) =>
    REGEX_TELEPHONE.test(v.trim()) || 'Numéro invalide (ex. 06 12 34 56 78).',
  adresse: (v) => v.trim().length >= 5 || 'Veuillez saisir votre adresse.',
  codePostal: (v) => /^\d{5}$/.test(v.trim()) || 'Code postal invalide (5 chiffres).',
  ville: (v) => v.trim().length >= 2 || 'Veuillez saisir votre ville.',
};

/** Le mode « Livraison à domicile » est-il sélectionné ? */
function livraisonDomicile() {
  return formulaireClient.elements.livraison.value === 'domicile';
}

/** Liste des champs requis selon le mode de livraison choisi. */
function champsRequis() {
  const base = ['nom', 'prenom', 'email', 'telephone'];
  return livraisonDomicile() ? [...base, 'adresse', 'codePostal', 'ville'] : base;
}

/** Valide un champ et affiche/efface son message d'erreur. Retourne true si valide. */
function validerChamp(nomChamp, afficherErreur = true) {
  const champ = formulaireClient.elements[nomChamp];
  const resultat = VALIDATEURS[nomChamp](champ.value);
  const valide = resultat === true;

  if (afficherErreur) {
    const messageErreur = document.getElementById(`erreur-${nomChamp}`);
    champ.setAttribute('aria-invalid', String(!valide));
    if (messageErreur) messageErreur.textContent = valide ? '' : resultat;
  }

  return valide;
}

/** Active/désactive « Suivant » : bloqué tant que tout n'est pas valide. */
function rafraichirEtape2() {
  const toutValide = champsRequis().every((nom) => validerChamp(nom, false));
  boutonSuivant.disabled = !toutValide;
}

/* Affichage conditionnel du bloc adresse selon le mode de livraison. */
formulaireClient.addEventListener('change', (evenement) => {
  if (evenement.target.name === 'livraison') {
    const domicile = livraisonDomicile();
    blocAdresse.hidden = !domicile;

    ['adresse', 'codePostal', 'ville'].forEach((nom) => {
      const champ = formulaireClient.elements[nom];
      champ.required = domicile;
      if (!domicile) {
        champ.removeAttribute('aria-invalid');
        const erreur = document.getElementById(`erreur-${nom}`);
        if (erreur) erreur.textContent = '';
      }
    });
  }

  rafraichirEtape2();
});

/* Validation au fil de la saisie (message affiché à la sortie du champ). */
formulaireClient.addEventListener(
  'blur',
  (evenement) => {
    const nomChamp = evenement.target.name;
    if (nomChamp && VALIDATEURS[nomChamp] && champsRequis().includes(nomChamp)) {
      validerChamp(nomChamp);
    }
  },
  true
);

formulaireClient.addEventListener('input', rafraichirEtape2);

document.getElementById('btn-retour-2').addEventListener('click', () => allerEtape(1));

boutonSuivant.addEventListener('click', () => {
  const valide = champsRequis().every((nom) => validerChamp(nom));
  if (valide) {
    afficherRecapitulatif();
    allerEtape(3);
  }
});

/* ==========================================================================
   ÉTAPE 3 — Commentaire + récapitulatif + envoi
   ========================================================================== */

const conteneurRecap = document.getElementById('recapitulatif');
const boutonEnvoyer = document.getElementById('btn-envoyer');
const erreurEnvoi = document.getElementById('erreur-envoi');

/** Construit l'objet client à partir du formulaire de l'étape 2. */
function donneesClient() {
  const elements = formulaireClient.elements;
  const client = {
    nom: elements.nom.value.trim(),
    prenom: elements.prenom.value.trim(),
    email: elements.email.value.trim(),
    telephone: elements.telephone.value.trim(),
  };

  const livraison = { mode: livraisonDomicile() ? 'domicile' : 'point-de-vente' };
  if (livraison.mode === 'domicile') {
    livraison.adresse = elements.adresse.value.trim();
    livraison.codePostal = elements.codePostal.value.trim();
    livraison.ville = elements.ville.value.trim();
  }

  return { client, livraison };
}

/** Texte lisible d'une composition (ex. « 2 Hibiscus, 3 Mangue... »). */
function decrireComposition(composition) {
  return SAVEURS.filter((s) => Number(composition[s.id]) > 0)
    .map((s) => `${composition[s.id]} × ${s.nom}`)
    .join(', ');
}

/** Affiche le récapitulatif de commande à l'étape 3. */
function afficherRecapitulatif() {
  const { client, livraison } = donneesClient();

  const blocsCoffrets = panier
    .map((item) => {
      const coffret = COFFRETS[item.type];
      const boites = item.compositions
        .map((compo, i) => `<li>Boîte ${i + 1} : ${decrireComposition(compo)}</li>`)
        .join('');
      return `
      <div class="recap__section">
        <h3>${coffret.nom} × ${item.quantite} (${formaterPrix(coffret.prix * item.quantite)})</h3>
        <ul class="recap__liste">${boites}</ul>
      </div>`;
    })
    .join('');

  const livraisonTexte =
    livraison.mode === 'domicile'
      ? `Livraison à domicile — ${livraison.adresse}, ${livraison.codePostal} ${livraison.ville}`
      : 'Récupération au point de vente';

  conteneurRecap.innerHTML = `
    ${blocsCoffrets}
    <div class="recap__section">
      <h3>Vos coordonnées</h3>
      <ul class="recap__liste">
        <li>${client.prenom} ${client.nom}</li>
        <li>${client.email}</li>
        <li>${client.telephone}</li>
        <li>${livraisonTexte}</li>
      </ul>
    </div>
    <p class="recap__total">
      <span>Total indicatif</span>
      <span>${formaterPrix(calculerTotal(panier))}</span>
    </p>`;
}

document.getElementById('btn-retour-3').addEventListener('click', () => allerEtape(2));

/* Envoi de la commande au serveur. */
boutonEnvoyer.addEventListener('click', async () => {
  // Validation centralisée de dernier recours avant l'envoi.
  if (!validerCompositions(panier).valide) {
    allerEtape(1);
    return;
  }

  const { client, livraison } = donneesClient();
  const commande = {
    items: panier.map((item) => ({
      type: item.type,
      nom: COFFRETS[item.type].nom,
      taille: item.taille,
      quantite: item.quantite,
      prixUnitaire: COFFRETS[item.type].prix,
      compositions: item.compositions,
    })),
    client,
    livraison,
    commentaire: document.getElementById('commentaire').value.trim(),
    total: calculerTotal(panier),
    date: new Date().toISOString(),
  };

  boutonEnvoyer.disabled = true;
  boutonEnvoyer.textContent = 'Envoi en cours…';
  erreurEnvoi.hidden = true;

  try {
    const reponse = await fetch('/api/commande', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commande),
    });

    if (!reponse.ok) throw new Error(`Réponse serveur ${reponse.status}`);

    afficherConfirmation(commande);
    viderPanier();
    panier = [];
  } catch (erreur) {
    console.error('Échec de l’envoi de la commande :', erreur);
    erreurEnvoi.hidden = false;
    boutonEnvoyer.disabled = false;
    boutonEnvoyer.textContent = 'Envoyer ma commande';
  }
});

/** Remplace le tunnel par le message de remerciement + récap (cf. brief). */
function afficherConfirmation(commande) {
  document.getElementById('tunnel').hidden = true;
  panneauConfirmation.hidden = false;

  const recapFinal = conteneurRecap.innerHTML;
  panneauConfirmation.innerHTML = `
    <div class="confirmation">
      <div class="confirmation__picto" aria-hidden="true">✓</div>
      <h1>Merci pour votre confiance !</h1>
      <p>
        Nous vous contacterons dans les plus brefs délais pour le paiement
        et la livraison.
      </p>
      <p class="panier-total__note">
        Un récapitulatif a été envoyé à ${commande.client.email}.
      </p>
    </div>
    <div class="recap">${recapFinal}</div>
    <div class="etape-nav">
      <a class="btn btn--secondaire" href="/">Retour à l'accueil</a>
      <a class="btn btn--principal" href="/saveurs">Redécouvrir nos saveurs</a>
    </div>`;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --------------------------------------------------------------------------
   Démarrage
   -------------------------------------------------------------------------- */

if (panier.length) {
  afficherComposition();
  allerEtape(1);
  rafraichirEtape2();
}
