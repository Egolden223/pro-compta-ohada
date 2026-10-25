# CHANGELOG — PRO COMPTA OHADA v2 (version finale)

## Version finale (23/10/2026)

Livraison consolidée de tous les lots P0 → Priorité C.

### Corrections moteur (P0/P1)
- Paie (IUTS, comptes 422, cotisations)
- Stock / CMV (6031/311), bons de commande (goodsReceived)
- Bilan (reclassement découverts), IS (réintégrations)
- Contrepassation, écritures verrouillées

### Fonctionnalités avancées (P2 + commercial)
- TFT, budget, checklist clôture
- Lettrage, facturation récurrente
- Relances, balance âgée

### Priorité A — Conformité SN
- ESS / soldes intermédiaires de gestion
- Notes annexes éditables
- Provisions d’inventaire (491, 39, 191)
- Amortissement avec valeur résiduelle

### Priorité B — PME UEMOA
- Mobile Money (5218/5219)
- RAS (4472)
- CUMP / FIFO
- Assistant écritures types
- Pièces jointes

### Priorité C — Cabinet & dépôt
- Systèmes SMT / Allégé / Normal
- Profil SYCEBNL
- Liasse / DSF imprimable
- Multi-dossiers cabinet
- Facture normalisée + QR
- IFU / RCCM

### Navigation principale
Brouillard · Assistant · Documents · Stocks · Banque · Mobile Money ·
Paie/Immo · Gestion · Annexes & ESS · Liasse/DSF · Lettrage · Récurrente ·
Cabinet · Paramètres


## Alignement Sage (23/10/2026)

### Comptabilité analytique
- Axes / sections (COM, ADM, PROD…)
- Saisie d'écritures avec axe
- Résultat par axe (`/analytique`)

### Rapprochement bancaire
- Import CSV relevé (déjà présent, renforcé)
- Suggestions de rapprochement automatique (montant + date + libellé)
- Bouton « Rapprocher »

### Multi-utilisateurs locaux
- Rôles : admin, comptable, saisie, lecture
- Sélection utilisateur dans Paramètres
- Stockage local (pas multi-poste temps réel)

### Budget
- Champ `committed` (engagements) sur lignes budget

Inspiré des forces Sage 100 : analytique, rapprochement, profils, pilotage.


## Suite alignement Sage (24/10/2026)

### Analytique avancée
- **2 axes** par écriture (section + projet)
- **Balance analytique** (comptes × axes)

### BI / tableaux de bord
- Trésorerie, créances, dettes fournisseurs
- Taux de rapprochement bancaire
- Top charges, CA mensuel
- Factures impayées, devis, volume d'écritures

### Paie RH
- Congés acquis / pris par salarié
- Poste, +1 jour de congé

### Droits
- `can(write|post|admin|read)` selon rôle utilisateur
- Saisie bloquée en mode lecture


## Paie légale OHADA (24/10/2026)

### Calculs
- CNSS/CNPS salariale & patronale (taux + plafond pays)
- CMU / maladie (si taux pays)
- IUTS/ITS/IRPP (barème, parts fiscales)
- Taxe apprentissage / TFP
- Coût total employeur

### Bulletins
- Impression bulletin officiel (gains, retenues, charges patronales)
- Matricule, poste, congés, IFU entreprise

### Déclarations (équivalent DSN zone OHADA)
- État mensuel organisme social + impôt salarial
- Totaux à reverser, échéance j+cnssDay
- Préparation portail CNSS/CNPS/DGI (non-substitut)

### Comptabilisation
- Écritures 661/422, 431, 4471, 664 automatiques pour le mois

### Pays
- Libellés auto : CNSS, CNPS, IPRES, INPS… / IUTS, ITS, IRPP


## Charges patronales complètes + calendrier déclaratif (24/10/2026)

### Taxes & cotisations patronales prises en compte
- CNSS/CNPS patronale (taux + plafond)
- CMU / maladie patronale
- Accidents du travail (AT)
- Contribution logement
- Versement transport
- Taxe d'apprentissage
- TFP / formation
- Coût total employeur = brut + toutes charges patronales
- Écritures 664/431 détaillées par nature

### Calendrier déclaratif automatisé
- Mensuel : TVA, CNSS, IUTS/ITS, TFP, RAS
- Trimestriel : acomptes IS
- Semestriel : option régularisation CNSS
- Annuel : solde IS, liasse DSF, patente

### Rappels
- Statuts : en retard / urgent (≤10 j) / à venir / fait
- Estimations de montants depuis journal + paie
- Écran `/echeances` + bandeau dashboard
- Marquer fait / annuler


## Mise à jour taux OHADA 2026 (recherche web 24/10/2026)

Sources : CNSS/CNPS officiels, Africarrieres, AfricaPaieRH, Cleiss, DGI CI, teamed., guides paie 2026.

### Corrections majeures
| Pays | Cot. sal. | Cot. pat. | Plafond | Notes |
|------|-----------|-----------|---------|-------|
| Burkina Faso | 5,5 % | 16 % | **800 000** | AT inclus dans pat. |
| Côte d'Ivoire | 6,3 % | ~15,45 % | 3 375 000 | ITS 0–32 % barème dédié |
| Togo | 4 % | 17,5 % | — | Total 21,5 % |
| Bénin | 3,6 % | ~16,4 % | — | Échéance j+10 |
| Sénégal | 5,6 % | ~17,4 % | — | IPRES/CSS |
| Cameroun | 4,2 % | ~12,95 % | — | TVA 19,25 % |
| Gabon | 5 % | 18 % | 1 500 000 | Décret 12/2025, **trimestriel** |
| Mali | 3,6 % | ~15 % | — | INPS |
| Niger | 5,25 % | 15,4 % | — | TVA 19 % |
| Congo | 4 % | 16 % | — | IS 28 % |

### Déclarations
- CI : TVA/ITS le 15 ; DISA CNPS trimestrielle ; DSF/IS fin avril
- Gabon : CNSS trimestrielle (30/01, 30/04, 31/07, 31/10)
- Bénin : souvent le 10 du mois suivant
- Calendrier app mis à jour (échéances + rappels)

**Disclaimer :** taux et délais évoluent (lois de finances). Toujours confirmer auprès DGI / caisse locale.


## Acomptes provisionnels, IMF/IRM, IRCM (24/10/2026)

### Acomptes provisionnels d'IS
- Calcul sur base IS N-1 (saisie) ou estimation N
- Plancher = impôt minimum forfaitaire (CA × isMin)
- 3 acomptes (4 au Bénin)
- Enregistrement des paiements + solde estimé

### IMF / IRM
- Impôt minimum forfaitaire = CA × taux minimum pays
- IRM traité comme plancher minimum (terminologie variable selon pays)

### IRCM
- Obligation mensuelle au calendrier (retenues sur revenus de capitaux mobiliers)

### UI
- Panneau dédié dans Échéances & rappels


## États déclaratifs 100 % auto + imprimables (24/10/2026)

- Calcul automatique pour la période choisie :
  TVA, CNSS, IUTS/ITS, TFP, RAS, IRCM, acomptes IS, IMF/IRM, solde liasse
- Bouton **Imprimer** par état
- Bouton **Tout imprimer** (un document multi-pages)
- En-tête société (IFU, RCCM, pays)
- Totaux et notes d'échéance inclus


## Alignement Guide SYSCOHADA + Support formateurs (24/10/2026)

### États financiers officiels
- Bilan codes AD–RZ (brut / amort. / net N / net N-1)
- Notes annexes auto (conformité, méthodes, immos, stocks, clients, CP, retraite…)
- Comparabilité N/N-1 via « Archiver N → N-1 »
- Impression liasse complète (Bilan + CR + TFT + Notes)

### Systèmes comptables
- Allégé marqué comme **supprimé** (révision 2017) → bascule affichage NORMAL
- SMT et NORMAL conservés

### Approche par composants
- Saisie composants (coût, VR, durée)
- Dotation linéaire annuelle
- Report en notes annexes

### Engagements de retraite
- Provision (méthode simplifiée / actuarielle)
- Comptabilisation 691 / 196

### Frais accessoires d'achat
- Calculateur coût d'entrée = prix + accessoires (SYSCOHADA révisé)


## Points non bloquants SYSCOHADA (24/10/2026)

### Compte de résultat codes RA–XI
- Marge, production, VA, EBE, RE, RF, RAO, HAO, RAI, RN avec N/N-1

### TFT codes FA–ZH
- CAFG, flux exploitation / investissement / financement, variation trésorerie

### Impression portrait / paysage
- Boutons Liasse · CSS @page A4 portrait ou landscape

### Première application
- Frais d'établissement → RAN
- Primes de remboursement
- Reclassement composants
- Provision retraite antérieure (12 / 196)

### Consolidation D4C (simplifiée)
- Intégration globale / proportionnelle / mise en équivalence
- Intérêts minoritaires
- Notes de périmètre


## Assistant IA + Dictionnaire (24/10/2026)

### Dictionnaire comptable / financier / économique
- 70+ termes SYSCOHADA, fiscalité, social, finance
- Recherche par mot + filtre catégorie

### Diagnostic automatique
- Écritures incomplètes, montants invalides, même compte D/C
- Bilan déséquilibré, trésorerie négative, CP négatifs
- Créances élevées, TVA, libellés faibles, dates futures, paie manquante, IMF

### Rapports IA multi-destinataires
- Dirigeants, associés, banque, impôts, CNSS, comptable
- Rédaction locale à partir bilan/CR/TFT/alertes
- Impression + copie
- Guide pour brancher un LLM externe


## Financements, indemnités, ratios IA (24/10/2026)

### Module Financements
- Traites / traites avalisées, DAT, crédits documentaires
- Crédits bancaires / institutions, crédits au personnel
- Échéanciers clients et fournisseurs (tempérament)
- Génération auto des échéances, marquage payé, encours / impayés

### Indemnités de départ
- Licenciement, démission, retraite, fin de contrat, décès
- Préavis, indemnité, congés, gratification retraite
- Comptabilisation 668 / 422

### Rapports IA
- Ratios (liquidité, autonomie, ROE, ROA, marges, couverture)
- Graphiques texte (barres) CA / EBE / résultat / trésorerie
- Alertes échéances impayées instruments
