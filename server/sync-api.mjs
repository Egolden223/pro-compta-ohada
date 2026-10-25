/**
 * Endpoint de synchronisation optionnel.
 * En production, montez cette route sur votre serveur Node :
 *   POST /api/sync  { kind, payload, at, id }
 *
 * Exemple Express :
 *   import { handleSync } from './sync-api.mjs'
 *   app.post('/api/sync', express.json({ limit: '20mb' }), handleSync)
 *
 * Stockage simple fichier (remplacez par Postgres en multi-utilisateurs).
 */
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = process.env.SYNC_DATA_DIR || path.join(process.cwd(), 'data', 'sync')

export async function handleSync(req, res) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const body = req.body || {}
    const id = body.id || `op-${Date.now()}`
    const file = path.join(DATA_DIR, `${id}.json`)
    fs.writeFileSync(file, JSON.stringify(body, null, 2), 'utf8')
    // Snapshot courant
    if (body.kind === 'full_snapshot' && body.payload) {
      fs.writeFileSync(
        path.join(DATA_DIR, 'latest-snapshot.json'),
        JSON.stringify(body.payload, null, 2),
        'utf8',
      )
    }
    res.status(204).end()
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
