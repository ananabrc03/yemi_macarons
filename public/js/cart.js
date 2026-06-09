/**
 * cart.js — Gestion du panier (état + persistance localStorage).
 *
 * Modèle de données (cf. brief, section 8) :
 * le panier est un tableau d'items de la forme
 *   { type: '8', taille: 8, quantite: 2, compositions: [ {hibiscus: 2, mangue: 2, ...}, {...} ] }
 * `compositions` contient un objet par boîte (longueur = quantite).
 *
 * Les fonctions de calcul sont pures ; seules lirePanier/sauverPanier
 * touchent au localStorage.
 */

import { COFFRETS } from './data.js';

const CLE_STOCKAGE = 'yemi_panier';

/* --------------------------------------------------------------------------
   Persistance
   -------------------------------------------------------------------------- */

/** Lit le panier depuis le localStorage (tableau vide si absent/corrompu). */
export function lirePanier() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    const panier = brut ? JSON.parse(brut) : [];
    return Array.isArray(panier) ? panier : [];
  } catch {
    return [];
  }
}

/** Sauvegarde le panier et notifie l'interface (compteur header, etc.). */
export function sauverPanier(panier) {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(panier));
  document.dispatchEvent(new CustomEvent('panier:change', { detail: { panier } }));
}

/** Vide entièrement le panier (après envoi de la commande). */
export function viderPanier() {
  sauverPanier([]);
}

/* --------------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------------- */

/**
 * Ajoute `quantite` coffret(s) d'un type donné au panier.
 * Si le type existe déjà, on additionne les quantités.
 */
export function ajouterAuPanier(type, quantite) {
  const coffret = COFFRETS[type];
  if (!coffret || quantite < 1) return lirePanier();

  const panier = lirePanier();
  const existant = panier.find((item) => item.type === String(type));

  if (existant) {
    existant.quantite += quantite;
    existant.compositions = ajusterCompositions(existant);
  } else {
    panier.push({
      type: String(type),
      taille: coffret.taille,
      quantite,
      compositions: Array.from({ length: quantite }, () => ({})),
    });
  }

  sauverPanier(panier);
  return panier;
}

/** Modifie la quantité d'un item (supprime l'item si quantité <= 0). */
export function changerQuantite(type, quantite) {
  let panier = lirePanier();
  const item = panier.find((i) => i.type === String(type));
  if (!item) return panier;

  if (quantite <= 0) {
    panier = panier.filter((i) => i.type !== String(type));
  } else {
    item.quantite = quantite;
    // Cohérence : le nombre de blocs de composition suit la quantité.
    item.compositions = ajusterCompositions(item);
  }

  sauverPanier(panier);
  return panier;
}

/** Retire complètement un type de coffret du panier. */
export function retirerDuPanier(type) {
  const panier = lirePanier().filter((i) => i.type !== String(type));
  sauverPanier(panier);
  return panier;
}

/**
 * Ajuste le tableau `compositions` pour qu'il contienne exactement
 * `quantite` entrées (on tronque ou on complète avec des boîtes vides).
 */
export function ajusterCompositions(item) {
  const compositions = (item.compositions || []).slice(0, item.quantite);
  while (compositions.length < item.quantite) compositions.push({});
  return compositions;
}

/* --------------------------------------------------------------------------
   Calculs (fonctions pures)
   -------------------------------------------------------------------------- */

/** Nombre total de coffrets dans le panier (pour le compteur du header). */
export function compterArticles(panier = lirePanier()) {
  return panier.reduce((total, item) => total + item.quantite, 0);
}

/** Sous-total indicatif en euros (prix × quantités). */
export function calculerTotal(panier = lirePanier()) {
  return panier.reduce((total, item) => {
    const coffret = COFFRETS[item.type];
    return total + (coffret ? coffret.prix * item.quantite : 0);
  }, 0);
}

/** Somme des macarons saisis dans la composition d'une boîte. */
export function totalComposition(composition) {
  return Object.values(composition || {}).reduce((somme, n) => somme + (Number(n) || 0), 0);
}

/** Une boîte est complète si la somme des saveurs égale EXACTEMENT sa taille. */
export function boiteComplete(composition, taille) {
  return totalComposition(composition) === taille;
}

/**
 * Validation centralisée avant envoi (cf. brief, section 8) :
 * vérifie que chaque boîte de chaque item a une composition complète.
 * Retourne { valide, erreurs } où erreurs liste les boîtes incomplètes.
 */
export function validerCompositions(panier = lirePanier()) {
  const erreurs = [];

  panier.forEach((item) => {
    const compositions = ajusterCompositions(item);
    compositions.forEach((composition, index) => {
      if (!boiteComplete(composition, item.taille)) {
        erreurs.push({
          type: item.type,
          boite: index + 1,
          attendu: item.taille,
          obtenu: totalComposition(composition),
        });
      }
    });
  });

  return { valide: erreurs.length === 0, erreurs };
}
