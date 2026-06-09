/**
 * panier.js — Page Panier : affichage des coffrets ajoutés,
 * modification des quantités, suppression, sous-total indicatif
 * et lancement du tunnel de commande.
 */

import { initialiserUI } from './ui.js';
import {
  lirePanier,
  changerQuantite,
  retirerDuPanier,
  calculerTotal,
} from './cart.js';
import { COFFRETS, formaterPrix } from './data.js';

initialiserUI();

const conteneurListe = document.getElementById('panier-contenu');
const conteneurTotal = document.getElementById('panier-resume');

/** (Re)dessine entièrement la page à partir de l'état du panier. */
function afficherPanier() {
  const panier = lirePanier();

  if (!panier.length) {
    conteneurListe.innerHTML = `
      <div class="panier-vide">
        <h2>Votre panier est vide</h2>
        <p>Laissez-vous tenter par nos coffrets de macarons aux saveurs d'ailleurs.</p>
        <a class="btn btn--principal" href="/coffrets">Découvrir les coffrets</a>
      </div>`;
    conteneurTotal.innerHTML = '';
    return;
  }

  const lignes = panier
    .map((item) => {
      const coffret = COFFRETS[item.type];
      return `
      <li class="ligne-panier" data-type="${item.type}">
        <picture>
          <source srcset="${coffret.image}.webp" type="image/webp">
          <img class="ligne-panier__image" src="${coffret.image}.jpg"
               alt="${coffret.nom} Yémi Macarons" width="88" height="88">
        </picture>
        <div>
          <p class="ligne-panier__nom">${coffret.nom}</p>
          <p class="ligne-panier__prix">${formaterPrix(coffret.prix)} l'unité</p>
        </div>
        <div class="ligne-panier__actions">
          <div class="stepper" role="group" aria-label="Quantité de ${coffret.nom}">
            <button class="stepper__btn" type="button" data-action="moins"
                    aria-label="Retirer un coffret">−</button>
            <input class="stepper__valeur" type="number" inputmode="numeric"
                   value="${item.quantite}" min="1" max="20"
                   aria-label="Quantité de ${coffret.nom}">
            <button class="stepper__btn" type="button" data-action="plus"
                    aria-label="Ajouter un coffret">+</button>
          </div>
          <button class="ligne-panier__supprimer" type="button" data-action="supprimer">
            Supprimer
          </button>
        </div>
      </li>`;
    })
    .join('');

  conteneurListe.innerHTML = `<ul class="panier-liste">${lignes}</ul>`;

  conteneurTotal.innerHTML = `
    <div class="panier-total">
      <p class="panier-total__ligne">
        <span>Sous-total</span>
        <span>${formaterPrix(calculerTotal(panier))}</span>
      </p>
      <p class="panier-total__note">
        Montant indicatif. Aucun paiement en ligne : nous vous recontactons
        après l'envoi de votre commande pour le règlement et la livraison.
      </p>
      <a class="btn btn--principal btn--large" href="/commande">Commander</a>
    </div>`;
}

/* Délégation d'événements : steppers et suppression. */
conteneurListe.addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('button');
  if (!bouton) return;

  const ligne = bouton.closest('.ligne-panier');
  const type = ligne.dataset.type;
  const champ = ligne.querySelector('.stepper__valeur');
  const quantite = parseInt(champ.value, 10) || 1;

  switch (bouton.dataset.action) {
    case 'moins':
      changerQuantite(type, quantite - 1);
      break;
    case 'plus':
      changerQuantite(type, Math.min(20, quantite + 1));
      break;
    case 'supprimer':
      retirerDuPanier(type);
      break;
    default:
      return;
  }

  afficherPanier();
});

/* Saisie directe d'une quantité dans le champ. */
conteneurListe.addEventListener('change', (evenement) => {
  const champ = evenement.target.closest('.stepper__valeur');
  if (!champ) return;

  const ligne = champ.closest('.ligne-panier');
  const quantite = Math.min(20, Math.max(1, parseInt(champ.value, 10) || 1));
  changerQuantite(ligne.dataset.type, quantite);
  afficherPanier();
});

afficherPanier();
