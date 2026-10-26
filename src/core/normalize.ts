const MAP: Record<string, string> = {
  ā: 'a', ē: 'e', ī: 'i', ō: 'o', ū: 'u', ȳ: 'y', ӯ: 'y',
  Ā: 'A', Ē: 'E', Ī: 'I', Ō: 'O', Ū: 'U', Ȳ: 'Y',
}

export function stripMacrons(s: string): string {
  return s.normalize('NFC').replace(/[āēīōūȳӯĀĒĪŌŪȲ]/g, (ch) => MAP[ch]).replace(/̄/g, '')
}

export function searchKey(s: string): string {
  return stripMacrons(s).toLowerCase()
}
