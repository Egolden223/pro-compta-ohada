# CORRECTION — Apprentissage + sous-comptes + brouillard

Fichiers à placer **par-dessus** le dépôt `pro-compta-ohada` (même arborescence `src/...`).

## Contenu

| Fichier | Rôle |
|---------|------|
| `src/lib/types.ts` | `CustomAccount`, `JournalTemplate`, champs `customAccounts` / `journalTemplates` |
| `src/lib/seed.ts` | Initialisation `customAccounts: []`, `journalTemplates: []` |
| `src/lib/store.ts` | Actions `addCustomAccount`, `removeCustomAccount`, `addJournalTemplate`, etc. |
| `src/lib/account-utils.ts` | `allAccounts(custom)` plan + sous-comptes |
| `src/components/account-picker.tsx` | Saisie n° de compte ou libellé + liste filtrée |
| `src/pages/saisie.tsx` | Modèles / récurrents → préremplir, sauver modèle, PJ à l'enregistrement |
| `src/pages/misc.tsx` | Plan comptable : création de sous-comptes |
| `src/pages/assistant.tsx` | Espace d'apprentissage (exemples + question IA, **sans** écriture au journal) |

## Installation

```bash
# Depuis la racine du repo cloné
unzip -o CORRECTION_APPRENTISSAGE_SOUSCOMPTES.zip
# ou copier le dossier src/ par-dessus
git add src
git commit -m "feat: sous-comptes, modèles brouillard, apprentissage IA"
git push
```

Vercel rebuild automatique après push.

## Comportement

- **IA & Dictionnaire** : exemples concrets avec montant, jamais de poste au journal.
- **Brouillard** : modèles / récurrents préremplissent le formulaire ; validation manuelle obligatoire.
- **Plan comptable** : sous-comptes (5211, 5712, …) utilisables partout via AccountPicker.
- **Pièces justificatives** : upload à la saisie ou sur une ligne existante (📎).
