# Modèles d'écriture SYSCOHADA enrichis (TVA + RAS)

## Contenu

| Fichier | Rôle |
|---------|------|
| `src/lib/engine.ts` | 67 modèles dont **factures HT+TVA** et **prestations + RAS** |
| `src/pages/assistant.tsx` | Exemples multi-lignes chiffrés (montant = HT) |

## Nouveaux schémas pédagogiques

Quand l'utilisateur saisit un **montant HT** :

| Modèle | Écriture générée |
|--------|------------------|
| **Facture achat HT+TVA** | D 601 HT · D 4452 TVA · C 401 TTC |
| **Facture vente HT+TVA** | D 411 TTC · C 701 HT · C 4431 TVA |
| **Prestation vendue HT+TVA** | D 411 TTC · C **706** HT · C 4431 TVA |
| **Prestation reçue + RAS** | D 632 HT · C 401 (HT−RAS) · C **447** RAS |
| **Prestation TVA + RAS** | D 632 HT · D 4452 TVA · C 401 net · C 447 RAS |
| **Immobilisation HT+TVA** | D 2xx HT · D **4451** TVA · C 481 TTC |

Taux indicatifs : **TVA 18 %** (courant OHADA), **RAS 5 %** HT (ex. Sénégal prestations PP ≥ seuil).  
Les taux réels dépendent du **pays** (BF, CI, SN, CM…) — à adapter.

## Références

- Guide d'application SYSCOHADA / cas factures
- Écritures ADB Assist (TVA 18 %)
- CGI Sénégal art. 200 (RAS 5 % prestations)
- Pratique Burkina (RAS 1–5–20 % selon statut)

## Installation

```bash
unzip -o CORRECTION_MODELES_OHADA.zip
git add src/lib/engine.ts src/pages/assistant.tsx
git commit -m "feat: modèles facture TVA + RAS prestations (apprentissage)"
git push
```

Espace **IA & Dictionnaire** uniquement — aucune écriture n'est postée au journal.
