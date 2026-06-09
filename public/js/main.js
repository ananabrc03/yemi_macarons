/**
 * main.js — Point d'entrée commun, chargé sur les pages vitrines
 * (accueil, saveurs, coffrets, histoire) et les pages produit.
 * Initialise l'interface partagée et, si la page le demande,
 * le bloc d'achat (stepper + ajout au panier).
 */

import { initialiserUI, afficherToast } from './ui.js';
import { ajouterAuPanier } from './cart.js';
import { COFFRETS } from './data.js';

initialiserUI();

/* --------------------------------------------------------------------------
   Page produit : stepper de quantité + « Ajouter au panier »
   Le bloc d'achat porte l'attribut data-coffret="6|8|16".
   -------------------------------------------------------------------------- */

const blocAchat = document.querySelector('[data-coffret]');

if (blocAchat) {
  const type = blocAchat.dataset.coffret;
  const coffret = COFFRETS[type];

  const champQuantite = blocAchat.querySelector('.stepper__valeur');
  const boutonMoins = blocAchat.querySelector('[data-stepper="moins"]');
  const boutonPlus = blocAchat.querySelector('[data-stepper="plus"]');
  const boutonAjouter = blocAchat.querySelector('[data-action="ajouter"]');

  const MIN = 1;
  const MAX = 20;

  /** Lit la quantité saisie, bornée entre MIN et MAX. */
  function quantiteActuelle() {
    const valeur = parseInt(champQuantite.value, 10);
    return Number.isNaN(valeur) ? MIN : Math.min(MAX, Math.max(MIN, valeur));
  }

  function mettreAJourSteppers() {
    const quantite = quantiteActuelle();
    champQuantite.value = String(quantite);
    boutonMoins.disabled = quantite <= MIN;
    boutonPlus.disabled = quantite >= MAX;
  }

  boutonMoins.addEventListener('click', () => {
    champQuantite.value = String(quantiteActuelle() - 1);
    mettreAJourSteppers();
  });

  boutonPlus.addEventListener('click', () => {
    champQuantite.value = String(quantiteActuelle() + 1);
    mettreAJourSteppers();
  });

  champQuantite.addEventListener('change', mettreAJourSteppers);

  boutonAjouter.addEventListener('click', () => {
    const quantite = quantiteActuelle();
    ajouterAuPanier(type, quantite);

    const pluriel = quantite > 1 ? 's' : '';
    afficherToast(`${quantite} ${coffret.nom}${pluriel} ajouté${pluriel} au panier ✓`);

    champQuantite.value = '1';
    mettreAJourSteppers();
  });

  mettreAJourSteppers();
}
