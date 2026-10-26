// Verbs that may be labeled = (copular) or X (existential).
export const COPULAR_ALWAYS = ['sum-v', 'fio-v']
/** Verbs of naming/making/considering: their passive is copular (puer dux appellātus est). */
export const FACTITIVE = ['appello-v', 'voco-v', 'nomino-v', 'facio-v', 'dico-v', 'habeo-v', 'iudico-v', 'puto-v']
/** videor (“seem”) is copular too. */
export const COPULAR_PASSIVE = ['video-v', ...FACTITIVE]
export const COPULAR = [...COPULAR_ALWAYS, ...COPULAR_PASSIVE]
export const EXISTENTIAL = ['sum-v']
