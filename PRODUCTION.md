# PRO COMPTA OHADA — Guide production

Application web **installable** (PWA) pour **PC, tablette, Android, iPhone**, avec **base locale** et **synchronisation automatique** dès que le réseau revient.

## Architecture données

| Couche | Rôle |
|--------|------|
| **Zustand + localStorage** | Source de vérité immédiate (rapide) |
| **IndexedDB** | Miroir robuste (gros volumes, survie au quota) |
| **Service Worker** | Cache assets + pages → fonctionnement hors ligne |
| **File de sync** | Mutations hors ligne → POST `/api/sync` à la reconnexion |
| **PGLite / Postgres** (optionnel) | Auth & multi-dossiers côté serveur |

## Installation sur les appareils

### Android (Chrome / Edge)
1. Ouvrir l’URL HTTPS de l’app
2. Menu → **Installer l’application** (ou bannière « Installer »)
3. L’icône apparaît sur l’écran d’accueil — mode standalone

### iPhone / iPad (Safari)
1. Ouvrir l’URL dans **Safari**
2. Bouton **Partager** → **Sur l’écran d’accueil**
3. L’app s’ouvre sans barre Safari (standalone)

### PC Windows / macOS / Linux
1. Chrome / Edge / Chromium → icône **Installer** dans la barre d’adresse
2. Ou bouton **Installer** dans l’en-tête de l’app

> **HTTPS obligatoire** pour le Service Worker et l’installation PWA (sauf localhost).

## Lancer en production

```bash
# Installation
npm ci

# Build
npm run build

# Prévisualiser le build
npm run preview
# → servir le dossier dist/ derrière Nginx, Caddy, ou un hébergeur statique
```

### Variables d’environnement utiles

```env
# URL de l’API de sync (défaut : /api/sync)
# VITE_SYNC_ENDPOINT=https://api.exemple.com/api/sync

# Base Postgres (auth multi-utilisateurs — optionnel)
DATABASE_URL=postgres://user:pass@host:5432/procompta
```

### Endpoint de synchronisation

Un stub est fourni dans `server/sync-api.mjs`.  
Sans cet endpoint, l’app reste **100 % locale** (chaque appareil a sa base) ; le bouton Sync et la file d’attente fonctionnent, et un message indique que le serveur n’est pas configuré.

Pour **multi-appareils / multi-utilisateurs** : déployez `POST /api/sync` (fichier ou Postgres) et pointez `VITE_SYNC_ENDPOINT` si besoin.

## Hors ligne

- Navigation, saisie d’écritures, paie, factures, liasse : **disponibles hors ligne**
- Badge **Hors ligne — données locales** dans l’en-tête
- À la reconnexion : **sync automatique** (file + snapshot) toutes les ~90 s + au retour `online`

## Sauvegardes

- Paramètres / Gestion : export JSON
- API `downloadBackup()` / import fichier
- Miroir IndexedDB `pro-compta-ohada`

## Checklist déploiement

- [ ] HTTPS
- [ ] `manifest.webmanifest` + icônes 192 / 512 / 180
- [ ] Service Worker `/sw.js` servi sans cache agressif HTML
- [ ] Headers : `Cache-Control` adapté pour `index.html` (no-cache) et assets hashés (long cache)
- [ ] Optionnel : `/api/sync` + Postgres
- [ ] Test install Android + « Sur l’écran d’accueil » iOS + install desktop

## Support navigateurs

Chrome 90+, Edge 90+, Safari 16.4+ (iOS 16.4+), Firefox 90+ (PWA install limité sur iOS Firefox).
