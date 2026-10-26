import type { RawDataset } from './types.ts'

export async function fetchDataset(baseUrl: string): Promise<RawDataset> {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
  const get = async (f: string) => {
    const r = await fetch(base + f)
    if (!r.ok) throw new Error(`Could not load ${f}`)
    return r.json()
  }
  const m = await get('manifest.json')
  const [entries, n, adj, v, pron] = await Promise.all([
    get(m.entries), get(m.forms.n), get(m.forms.adj), get(m.forms.v), get(m.forms.pron),
  ])
  return { entries, forms: { n, adj, v, pron } }
}
