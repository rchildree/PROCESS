import { loadDatasetFromDir } from '../../src/core/loadDataset.node.ts'
import { buildLexicon } from '../../src/core/lexicon.ts'
import type { Lexicon } from '../../src/core/types.ts'

let cached: Lexicon | null = null
export function lex(): Lexicon {
  if (!cached) cached = buildLexicon(loadDatasetFromDir('public/data/knudsvig-731'))
  return cached
}
