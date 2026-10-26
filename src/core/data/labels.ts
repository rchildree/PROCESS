// Function labels (teacher's symbols). Add new labels here; the UI reads this list.
export type Label = 'S' | 'O' | 'SC' | 'OC' | 'V' | 'PV' | '=' | 'X' | 'PP' | 'ADV' | '+' | '↓'

export const LABELS: { id: Label; name: string }[] = [
  { id: 'S', name: 'subject' },
  { id: 'O', name: 'object' },
  { id: 'SC', name: 'subject complement' },
  { id: 'OC', name: 'object complement' },
  { id: 'V', name: 'verb' },
  { id: 'PV', name: 'passive verb' },
  { id: '=', name: 'copular verb' },
  { id: 'X', name: 'existential verb' },
  { id: 'PP', name: 'prepositional phrase' },
  { id: 'ADV', name: 'adverb / adverbial' },
  { id: '+', name: 'coordinating conjunction' },
  { id: '↓', name: 'subordinating conjunction' },
]

export const NOUN_LABELS: Label[] = ['S', 'O', 'SC', 'OC', 'PP', 'ADV']
export const VERB_LABELS: Label[] = ['V', 'PV', '=', 'X']
