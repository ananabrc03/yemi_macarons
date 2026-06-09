/**
 * data.js — Données catalogue de Yémi Macarons.
 * Source unique de vérité pour les coffrets et les saveurs,
 * partagée par toutes les pages (produit, panier, tunnel).
 */

/** Les 3 coffrets vendus (cf. brief, section 6.3). */
export const COFFRETS = {
  6: {
    type: '6',
    taille: 6,
    nom: 'Coffret 6 macarons',
    prix: 20,
    image: '/assets/img/coffret-6',
    url: '/coffrets/6-macarons',
    populaire: false,
  },
  8: {
    type: '8',
    taille: 8,
    nom: 'Coffret 8 macarons',
    prix: 25,
    image: '/assets/img/coffret-8',
    url: '/coffrets/8-macarons',
    populaire: true,
  },
  16: {
    type: '16',
    taille: 16,
    nom: 'Coffret 16 macarons',
    prix: 45,
    image: '/assets/img/coffret-16',
    url: '/coffrets/16-macarons',
    populaire: false,
  },
};

/** Les 5 saveurs signature (cf. brief, section 4). */
export const SAVEURS = [
  { id: 'hibiscus', nom: 'Hibiscus – Framboise' },
  { id: 'mangue', nom: 'Mangue – Gingembre – Citron vert' },
  { id: 'cacao', nom: 'Cacao – Piment végétarien – Piment d’Espelette' },
  { id: 'baobab', nom: 'Baobab – Fruit de la Passion' },
  { id: 'goyave', nom: 'Goyave – Noix de coco' },
];

/** Retourne le nom affichable d'une saveur à partir de son identifiant. */
export function nomSaveur(id) {
  const saveur = SAVEURS.find((s) => s.id === id);
  return saveur ? saveur.nom : id;
}

/** Formate un prix en euros (ex. « 25 € »). */
export function formaterPrix(montant) {
  return `${montant.toLocaleString('fr-FR')} €`;
}
