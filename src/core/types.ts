export type Pos = 'n' | 'adj' | 'v' | 'pron' | 'adv' | 'conj' | 'prep' | 'particle' | 'num' | 'phrase' | 'other'
export type Case = 'nom' | 'gen' | 'dat' | 'acc' | 'abl' | 'voc' | 'loc'
export type Num = 'sg' | 'pl'
export type Gender = 'm' | 'f' | 'n'
export type Tense = 'pres' | 'impf' | 'fut' | 'pf' | 'plupf' | 'futpf'
export type Mood = 'ind' | 'subj' | 'imp'
export type Voice = 'act' | 'pass'
export type Person = '1' | '2' | '3'

export interface Entry {
  id: string
  chapter: number
  lemma: string
  dict: string
  definition: string
  pos: Pos
  pp: (string | null)[]
  cls?: string
  gender?: string
  genSg?: string
  flags: string[]
}

export interface NomAnalysis { k: 'nom'; c: Case; n: Num; g: Gender; deg?: 'cmp' | 'sup' }
export interface VerbAnalysis {
  k: 'fin' | 'inf' | 'ptc' | 'imp' | 'ger'
  t?: Tense; m?: Mood; v?: Voice; p?: Person; n?: Num; c?: Case; g?: Gender
}
export type Analysis = NomAnalysis | VerbAnalysis

export interface Candidate { entryId: string; pos: Pos; analyses: Analysis[] }

export interface FormRow { s: string; l: string; a: Analysis[] }
export interface RawDataset { entries: Entry[]; forms: Record<'n' | 'adj' | 'v' | 'pron', FormRow[]> }

export type Check = { ok: true } | { ok: false; reason: string }

export interface Gloss { lemma: string; dict: string; definition: string; pos: Pos }

export interface Lexicon {
  entries: Map<string, Entry>
  lookup(surface: string): Candidate[]
  search(query: string, limit?: number): Entry[]
}
