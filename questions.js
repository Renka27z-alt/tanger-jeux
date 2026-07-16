// ====== QUIZ QUESTIONS TEXTE ======
// Lancées manuellement avec -qst start (owner uniquement)
// La question s'affiche 60 secondes, répond 1 point au premier qui trouve

const QUESTIONS = [
  // ── Histoire & Politique ──────────────────────────────────────
  { question: "Quel est le premier ministre français qui a fondé la Ve République ?", answers: ["de gaulle", "charles de gaulle"] },
  { question: "En quelle année la Révolution française a-t-elle commencé ?", answers: ["1789"] },
  { question: "Qui était le premier président des États-Unis ?", answers: ["washington", "george washington"] },
  { question: "Quel pays a lancé le premier satellite artificiel dans l'espace ?", answers: ["urss", "union sovietique", "russie"] },
  { question: "En quelle année le mur de Berlin est-il tombé ?", answers: ["1989"] },
  { question: "Qui a écrit la Déclaration des droits de l'homme en 1789 ?", answers: ["assemblee nationale", "constituante"] },
  { question: "Quel empire était gouverné par Napoléon Bonaparte ?", answers: ["empire francais", "france"] },
  { question: "Quelle est la capitale de l'Australie ?", answers: ["canberra"] },
  { question: "Quel pays possède le plus grand territoire au monde ?", answers: ["russie"] },
  { question: "En quelle année la Seconde Guerre mondiale s'est-elle terminée ?", answers: ["1945"] },

  // ── Sciences & Nature ──────────────────────────────────────────
  { question: "Quelle est la formule chimique de l'eau ?", answers: ["h2o"] },
  { question: "Combien de planètes composent notre système solaire ?", answers: ["8", "huit"] },
  { question: "Quel scientifique a découvert la gravité en observant une pomme tomber ?", answers: ["newton", "isaac newton"] },
  { question: "Quel est l'élément chimique dont le symbole est 'O' ?", answers: ["oxygene"] },
  { question: "Quelle planète est la plus proche du soleil ?", answers: ["mercure"] },
  { question: "Quelle est la vitesse de la lumière en km/s (arrondie) ?", answers: ["300000", "300 000"] },
  { question: "Combien de chromosomes possède un être humain normal ?", answers: ["46"] },
  { question: "Quel animal est le plus rapide sur terre ?", answers: ["guepard"] },
  { question: "Quelle est la plus grande planète du système solaire ?", answers: ["jupiter"] },
  { question: "Combien d'os y a-t-il dans le corps humain adulte ?", answers: ["206"] },

  // ── Culture & Divers ───────────────────────────────────────────
  { question: "Quelle est la plus longue rivière du monde ?", answers: ["nil", "amazone"] },
  { question: "Qui a peint la Joconde ?", answers: ["leonard de vinci", "leonard de vinci", "da vinci"] },
  { question: "Dans quel pays se trouve la Tour de Pise ?", answers: ["italie"] },
  { question: "Combien de joueurs composent une équipe de football sur le terrain ?", answers: ["11", "onze"] },
  { question: "Quelle est la monnaie du Japon ?", answers: ["yen"] },
  { question: "Quel est le plus haut sommet du monde ?", answers: ["everest", "mont everest"] },
  { question: "En quelle année les premiers hommes ont marché sur la lune ?", answers: ["1969"] },
  { question: "Quelle langue est la plus parlée dans le monde ?", answers: ["mandarin", "chinois"] },
  { question: "Quel pays a remporté la Coupe du Monde 2018 ?", answers: ["france"] },
  { question: "Quelle est la capitale du Brésil ?", answers: ["brasilia"] },
];

module.exports = { QUESTIONS };
