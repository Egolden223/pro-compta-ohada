/** Dictionnaire comptable / financier / économique — SYSCOHADA & gestion. */

export type DictEntry = {
  term: string;
  aliases?: string[];
  category: "comptable" | "financier" | "economique" | "fiscal" | "social" | "ohada";
  definition: string;
  example?: string;
};

export const DICTIONARY: DictEntry[] = [
  { term: "SYSCOHADA", category: "ohada", aliases: ["syscohada révisé", "pcgo"], definition: "Système Comptable OHADA : référentiel comptable unique des États membres de l'OHADA. Version révisée applicable depuis 2018 (comptes individuels).", example: "Les états financiers sont établis selon le SYSCOHADA révisé." },
  { term: "OHADA", category: "ohada", definition: "Organisation pour l'Harmonisation en Afrique du Droit des Affaires. Espace juridique commun à 17 États africains." },
  { term: "Acte uniforme", category: "ohada", aliases: ["audcif"], definition: "Texte juridique OHADA d'application directe dans les États parties. L'Acte uniforme relatif au droit comptable et à l'information financière fonde le SYSCOHADA." },
  { term: "Bilan", category: "comptable", aliases: ["état de situation financière"], definition: "État financier présentant à une date donnée l'actif (emplois) et le passif (ressources) de l'entité. Codes SYSCOHADA AD à RZ.", example: "Le total actif doit égaler le total passif." },
  { term: "Compte de résultat", category: "comptable", aliases: ["cr", "pnl"], definition: "État des charges et produits de l'exercice, en cascade (marge, VA, EBE, résultat d'exploitation, RAO, résultat net). Codes RA à XI." },
  { term: "TFT", category: "comptable", aliases: ["tableau des flux de trésorerie", "tafire"], definition: "Tableau des flux de trésorerie : explique la variation de trésorerie par les flux d'exploitation, d'investissement et de financement. Codes FA à ZH." },
  { term: "Notes annexes", category: "comptable", aliases: ["annexe"], definition: "État financier de même valeur que le bilan, le CR et le TFT. Elles précisent les méthodes, ventilations et engagements hors bilan." },
  { term: "Double entrée", category: "comptable", aliases: ["partie double"], definition: "Principe selon lequel toute opération est enregistrée au débit d'un compte et au crédit d'un autre, pour le même montant." },
  { term: "Journal", category: "comptable", aliases: ["brouillard"], definition: "Livre chronologique des écritures comptables avant centralisation dans les comptes." },
  { term: "Balance", category: "comptable", definition: "Liste des comptes avec totaux débits, crédits et soldes. Instrument de contrôle (débit = crédit)." },
  { term: "Lettrage", category: "comptable", aliases: ["rapprochement de comptes"], definition: "Technique qui associe les écritures d'un même compte (ex. client) pour identifier ce qui reste ouvert (impayés)." },
  { term: "Amortissement", category: "comptable", definition: "Répartition systématique du coût d'une immobilisation sur sa durée d'utilité (linéaire, dégressif, unités d'œuvre)." },
  { term: "Dépréciation", category: "comptable", aliases: ["perte de valeur"], definition: "Constatation de la perte de valeur d'un actif lorsque sa valeur recouvrable devient inférieure à sa valeur nette comptable." },
  { term: "Provision", category: "comptable", definition: "Passif dont l'échéance ou le montant est incertain, mais dont l'obligation est actuelle et la sortie de ressources probable." },
  { term: "Approche par composants", category: "comptable", aliases: ["composants"], definition: "Ventilation d'une immobilisation en parties ayant des durées d'utilité différentes, chacune amortie séparément (SYSCOHADA révisé)." },
  { term: "CUMP", category: "comptable", aliases: ["coût unitaire moyen pondéré"], definition: "Méthode de valorisation des stocks : coût moyen de toutes les entrées, recalculé à chaque entrée." },
  { term: "Inventaire permanent", category: "comptable", definition: "Suivi continu des stocks en quantité et valeur à chaque mouvement. Contraire de l'inventaire intermittent." },
  { term: "Inventaire intermittent", category: "comptable", definition: "Les stocks ne sont ajustés qu'en fin d'exercice par inventaire physique et variation de stock." },
  { term: "Frais accessoires", category: "comptable", definition: "Coûts directement attribuables à l'acquisition (transport, assurances, droits). Incorporés au coût d'entrée des stocks/immos (SYSCOHADA révisé)." },
  { term: "CAFG", category: "financier", aliases: ["capacité d'autofinancement"], definition: "Capacité d'autofinancement globale : résultat net + dotations − reprises. Ressource interne générée par l'activité." },
  { term: "BFR", category: "financier", aliases: ["besoin en fonds de roulement"], definition: "Besoin en fonds de roulement = stocks + créances clients − dettes fournisseurs (et assimilés). Financement du cycle d'exploitation." },
  { term: "Fonds de roulement", category: "financier", aliases: ["fdr"], definition: "Ressources stables − actif immobilisé. Marge de sécurité pour financer le BFR." },
  { term: "Trésorerie nette", category: "financier", definition: "Disponibilités et équivalents − concours bancaires courants. Solde de trésorerie de l'entité." },
  { term: "EBE", category: "financier", aliases: ["excédent brut d'exploitation"], definition: "Excédent brut d'exploitation : VA − impôts et taxes − charges de personnel. Performance opérationnelle avant politique d'investissement et financement." },
  { term: "VA", category: "financier", aliases: ["valeur ajoutée"], definition: "Valeur ajoutée : production + marge commerciale − consommations de biens et services en provenance de tiers." },
  { term: "RAO", category: "comptable", aliases: ["résultat des activités ordinaires"], definition: "Résultat des activités ordinaires = résultat d'exploitation + résultat financier." },
  { term: "HAO", category: "comptable", aliases: ["hors activités ordinaires"], definition: "Opérations exceptionnelles, hors cycle normal d'activité (cessions d'immos significatives, sinistres, etc.)." },
  { term: "IS", category: "fiscal", aliases: ["impôt sur les sociétés", "impôt sur les bénéfices"], definition: "Impôt sur le bénéfice des sociétés. Taux et acomptes selon le pays OHADA." },
  { term: "IMF", category: "fiscal", aliases: ["impôt minimum forfaitaire", "irm"], definition: "Impôt minimum forfaitaire calculé sur le chiffre d'affaires. Plancher de l'IS lorsque le bénéfice est faible ou nul." },
  { term: "Acompte provisionnel", category: "fiscal", aliases: ["acompte is"], definition: "Versement anticipé d'IS pendant l'exercice, en général en 3 ou 4 fractions, sur la base de l'IS N-1 ou de l'IMF." },
  { term: "TVA", category: "fiscal", definition: "Taxe sur la valeur ajoutée. Collectée sur les ventes, déductible sur les achats ; la différence est due à l'État." },
  { term: "RAS", category: "fiscal", aliases: ["retenue à la source"], definition: "Retenue opérée par le payeur sur certaines prestations ou revenus, reversée à l'administration fiscale." },
  { term: "IRCM", category: "fiscal", definition: "Impôt sur le revenu des capitaux mobiliers (dividendes, intérêts). Souvent retenu à la source." },
  { term: "IUTS", category: "fiscal", aliases: ["its", "impôt salarial"], definition: "Impôt unique sur les traitements et salaires (ou ITS selon le pays). Retenu sur le salaire net à payer." },
  { term: "CNSS", category: "social", aliases: ["cnps", "ipres"], definition: "Caisse nationale de sécurité sociale (ou équivalent pays). Cotisations salariales et patronales sur la rémunération." },
  { term: "TFP", category: "social", aliases: ["taxe d'apprentissage"], definition: "Taxe de formation professionnelle / apprentissage due par l'employeur, assise sur la masse salariale." },
  { term: "SMT", category: "ohada", aliases: ["système minimal de trésorerie"], definition: "Système comptable simplifié pour très petites entités : recettes, dépenses, état des créances et dettes non échues." },
  { term: "Système normal", category: "ohada", definition: "Référentiel complet SYSCOHADA : bilan, compte de résultat, TFT et notes annexes. Le système allégé a été supprimé en 2017." },
  { term: "Engagement de retraite", category: "comptable", aliases: ["indemnités de départ"], definition: "Obligation de l'employeur au titre des départs à la retraite. Provision obligatoire si critères SYSCOHADA remplis (obligation actuelle, sortie probable, montant fiable)." },
  { term: "Liquidité", category: "financier", definition: "Capacité à faire face aux dettes à court terme avec les actifs circulants (ratio de liquidité générale, réduite, immédiate)." },
  { term: "Solvabilité", category: "financier", definition: "Capacité à faire face à l'ensemble des dettes avec l'actif total. Ratio d'autonomie financière = capitaux propres / total passif." },
  { term: "Rentabilité", category: "financier", aliases: ["roe", "roa"], definition: "Mesure du résultat par rapport aux moyens engagés (capitaux propres, actif, CA)." },
  { term: "Chiffre d'affaires", category: "economique", aliases: ["ca"], definition: "Montant des ventes de biens et services de l'exercice (comptes de classe 7, hors produits financiers et HAO selon analyse)." },
  { term: "Marge commerciale", category: "financier", definition: "Ventes de marchandises − coût d'achat des marchandises vendues (achats ± variation de stocks)." },
  { term: "Seuil de rentabilité", category: "financier", aliases: ["point mort"], definition: "Niveau d'activité (CA) pour lequel le résultat est nul : charges fixes couvertes par la marge sur coûts variables." },
  { term: "Effet de levier", category: "financier", definition: "Impact de l'endettement sur la rentabilité des capitaux propres. Positif si la rentabilité économique > coût de la dette." },
  { term: "Créance", category: "comptable", definition: "Droit de l'entité sur un tiers (client, État, personnel…). À l'actif du bilan." },
  { term: "Dette", category: "comptable", definition: "Obligation envers un tiers (fournisseur, banque, fiscal, social…). Au passif du bilan." },
  { term: "Immobilisation", category: "comptable", aliases: ["actif immobilisé"], definition: "Actif destiné à servir de façon durable (incorporel, corporel, financier). Classe 2." },
  { term: "Actif circulant", category: "comptable", definition: "Actifs à rotation rapide : stocks, créances d'exploitation, disponibilités." },
  { term: "Capitaux propres", category: "comptable", aliases: ["fonds propres"], definition: "Ressources appartenant aux propriétaires : capital, réserves, report à nouveau, résultat, subventions d'investissement." },
  { term: "Contrepassation", category: "comptable", aliases: ["extourne"], definition: "Écriture inverse d'une écriture antérieure pour l'annuler, en conservant la trace d'audit." },
  { term: "Pièce justificative", category: "comptable", definition: "Document (facture, quittance, avis de virement…) prouvant l'opération enregistrée. Obligatoire." },
  { term: "Exercice comptable", category: "comptable", definition: "Période de 12 mois (sauf démarrage ou cessation) sur laquelle sont établis les états financiers." },
  { term: "Clôture", category: "comptable", definition: "Ensemble des travaux d'inventaire, régularisations, détermination du résultat et établissement des états financiers. Délai max. 4 mois après la date de clôture (Acte uniforme)." },
  { term: "Rapprochement bancaire", category: "comptable", definition: "Comparaison entre le solde comptable banque et le relevé bancaire pour identifier chèques non débités, remises non créditées, etc." },
  { term: "Analytique", category: "comptable", aliases: ["comptabilité analytique"], definition: "Comptabilité par axes (sections, projets, activités) pour analyser les coûts et marges au-delà de la comptabilité générale." },
  { term: "Budget", category: "financier", definition: "Prévision chiffrée des charges et produits. Comparé au réalisé pour piloter les écarts." },
  { term: "Inflation", category: "economique", definition: "Hausse générale et durable des prix. Impacte les stocks, les créances et le pouvoir d'achat." },
  { term: "Dévaluation", category: "economique", definition: "Baisse officielle de la valeur d'une monnaie par rapport à une référence. Affecte les opérations en devises." },
  { term: "FCFA", category: "economique", aliases: ["xof", "xaf"], definition: "Franc de la Communauté Financière Africaine (UEMOA XOF / CEMAC XAF), monnaie de nombreux États OHADA." },
  { term: "UEMOA", category: "economique", definition: "Union Économique et Monétaire Ouest-Africaine (8 États, FCFA XOF)." },
  { term: "CEMAC", category: "economique", definition: "Communauté Économique et Monétaire de l'Afrique Centrale (6 États, FCFA XAF)." },
  { term: "DSF", category: "fiscal", aliases: ["liasse fiscale"], definition: "Déclaration statistique et fiscale : liasse annuelle déposée auprès de l'administration (bilan, CR, annexes fiscales)." },
  { term: "IFU", category: "fiscal", aliases: ["niu", "nif"], definition: "Identifiant fiscal unique (ou NIU/NIF selon le pays) de l'entité auprès de l'administration fiscale." },
  { term: "RCCM", category: "ohada", definition: "Registre du Commerce et du Crédit Mobilier : immatriculation légale des commerçants et sociétés." },
  { term: "Patente", category: "fiscal", aliases: ["taxe professionnelle"], definition: "Taxe locale annuelle due par les entreprises au titre de l'exercice d'une activité professionnelle." },
  { term: "Mobile Money", category: "financier", aliases: ["momo", "orange money", "wave"], definition: "Paiement et encaissement via portefeuille mobile. À comptabiliser comme compte de trésorerie dédié." },
  { term: "Échéance", category: "financier", definition: "Date à laquelle une dette ou une obligation déclarative doit être honorée (TVA, CNSS, acomptes IS…)." },
  { term: "Solde débiteur", category: "comptable", definition: "Quand le total des débits d'un compte dépasse le total des crédits (typique des comptes d'actif et de charges)." },
  { term: "Solde créditeur", category: "comptable", definition: "Quand le total des crédits dépasse le total des débits (typique des comptes de passif et de produits)." },
  { term: "Classe 1", category: "comptable", definition: "Comptes de ressources durables : capital, réserves, emprunts, provisions (passif)." },
  { term: "Classe 2", category: "comptable", definition: "Actif immobilisé : incorporel, corporel, financier." },
  { term: "Classe 3", category: "comptable", definition: "Stocks et en-cours." },
  { term: "Classe 4", category: "comptable", definition: "Tiers : clients, fournisseurs, personnel, sociaux, État, associés…" },
  { term: "Classe 5", category: "comptable", definition: "Trésorerie : banques, caisse, crédits de trésorerie, virements internes." },
  { term: "Classe 6", category: "comptable", definition: "Charges des activités ordinaires (achats, services, personnel, impôts, dotations…)." },
  { term: "Classe 7", category: "comptable", definition: "Produits des activités ordinaires (ventes, production, subventions d'exploitation, reprises…)." },
  { term: "Classe 8", category: "comptable", definition: "Comptes des autres charges et produits (HAO) et participation, impôts sur le résultat." },
];

export function searchDictionary(query: string, category?: DictEntry["category"]): DictEntry[] {
  const q = query.trim().toLowerCase();
  let list = DICTIONARY;
  if (category) list = list.filter((e) => e.category === category);
  if (!q) return list.slice().sort((a, b) => a.term.localeCompare(b.term, "fr"));
  return list
    .filter((e) => {
      const hay = [e.term, ...(e.aliases || []), e.definition, e.example || ""].join(" ").toLowerCase();
      return hay.includes(q) || e.term.toLowerCase().startsWith(q);
    })
    .sort((a, b) => {
      const as = a.term.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.term.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || a.term.localeCompare(b.term, "fr");
    });
}
