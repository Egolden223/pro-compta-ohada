# PRO COMPTA OHADA — Version production

Comptabilité **SYSCOHADA révisé** · PWA installable · hors ligne · sync auto.

## Démarrage rapide

```bash
npm ci
npm run dev          # développement http://localhost:8080
npm run build        # production → dist/
npm run preview      # tester le build
```

## Installer comme application

- **Android / PC** : bouton **Installer** dans l’app (Chrome/Edge)
- **iPhone** : Safari → Partager → **Sur l’écran d’accueil**

Voir **PRODUCTION.md** pour le déploiement, la base et la synchronisation.

## Modules principaux

- Journal, balance, lettrage, liasse (Bilan AD–RZ, CR RA–XI, TFT FA–ZH)
- Commercial, stock, paie multi-pays OHADA, déclarations & rappels
- Financements (traites, DAT, CREDOC, crédits, tempéraments)
- Assistant IA, dictionnaire, ratios, rapports multi-destinataires
- Banque, Mobile Money, analytique, multi-dossiers

## Données

Local-first (localStorage + IndexedDB) · file de sync · endpoint optionnel `/api/sync`.
