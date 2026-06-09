/**
 * ui.js — Interactions d'interface communes à toutes les pages :
 * menu burger, compteur du panier dans le header, toast de confirmation,
 * apparition douce des sections au scroll.
 */

import { compterArticles } from './cart.js';

/* --------------------------------------------------------------------------
   Menu burger (mobile)
   -------------------------------------------------------------------------- */

function initialiserBurger() {
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.header__nav');
  if (!burger || !nav) return;

  burger.addEventListener('click', () => {
    const ouvert = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!ouvert));
    nav.classList.toggle('header__nav--ouverte', !ouvert);
  });

  // Referme le menu quand on clique sur un lien (navigation mobile).
  nav.addEventListener('click', (evenement) => {
    if (evenement.target.closest('a')) {
      burger.setAttribute('aria-expanded', 'false');
      nav.classList.remove('header__nav--ouverte');
    }
  });
}

/* --------------------------------------------------------------------------
   Compteur du panier (header)
   -------------------------------------------------------------------------- */

/** Met à jour le badge du header avec la somme des quantités. */
export function rafraichirCompteur() {
  const compteur = document.querySelector('.panier-lien__compteur');
  if (!compteur) return;

  const total = compterArticles();
  compteur.textContent = String(total);
  compteur.classList.toggle('panier-lien__compteur--vide', total === 0);
}

/* --------------------------------------------------------------------------
   Toast (retour visuel d'ajout au panier)
   -------------------------------------------------------------------------- */

let minuteurToast = null;

/** Affiche un message furtif en bas d'écran. */
export function afficherToast(message) {
  let toast = document.querySelector('.toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }

  toast.textContent = message;

  // Force un reflow pour rejouer la transition si le toast est déjà visible.
  toast.classList.remove('toast--visible');
  void toast.offsetWidth;
  toast.classList.add('toast--visible');

  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => toast.classList.remove('toast--visible'), 2600);
}

/* --------------------------------------------------------------------------
   Apparition douce au scroll (IntersectionObserver)
   -------------------------------------------------------------------------- */

function initialiserApparitions() {
  const elements = document.querySelectorAll('.apparition');
  if (!elements.length || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('apparition--visible'));
    return;
  }

  const observateur = new IntersectionObserver(
    (entrees) => {
      entrees.forEach((entree) => {
        if (entree.isIntersecting) {
          entree.target.classList.add('apparition--visible');
          observateur.unobserve(entree.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  elements.forEach((el) => observateur.observe(el));
}

/* --------------------------------------------------------------------------
   Initialisation commune
   -------------------------------------------------------------------------- */

export function initialiserUI() {
  initialiserBurger();
  initialiserApparitions();
  rafraichirCompteur();

  // Le compteur se met à jour en temps réel à chaque mutation du panier.
  document.addEventListener('panier:change', rafraichirCompteur);
}
