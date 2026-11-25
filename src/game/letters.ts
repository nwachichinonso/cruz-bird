export type Letter = {
  id: string;
  example: string;
};

export const LETTERS: Letter[] = [
  { id: "A", example: "apple" },
  { id: "B", example: "ball" },
  { id: "C", example: "cat" },
  { id: "D", example: "dog" },
  { id: "E", example: "egg" },
  { id: "F", example: "fish" },
  { id: "G", example: "goat" },
  { id: "H", example: "hat" },
  { id: "I", example: "igloo" },
  { id: "J", example: "jam" },
  { id: "K", example: "kite" },
  { id: "L", example: "lion" },
  { id: "M", example: "moon" },
  { id: "N", example: "nest" },
  { id: "O", example: "octopus" },
  { id: "P", example: "pig" },
  { id: "Q", example: "queen" },
  { id: "R", example: "rain" },
  { id: "S", example: "sun" },
  { id: "T", example: "tiger" },
  { id: "U", example: "umbrella" },
  { id: "V", example: "van" },
  { id: "W", example: "water" },
  { id: "X", example: "box" },
  { id: "Y", example: "yellow" },
  { id: "Z", example: "zebra" },
];

const ALIASES: Record<string, string[]> = {
  A: ["a", "ay"],
  B: ["b", "bee", "be"],
  C: ["c", "see", "sea", "cee"],
  D: ["d", "dee", "de"],
  E: ["e", "ee"],
  F: ["f", "ef", "eff"],
  G: ["g", "gee", "jee"],
  H: ["h", "aitch", "haitch", "ache"],
  I: ["i", "eye", "aye"],
  J: ["j", "jay"],
  K: ["k", "kay"],
  L: ["l", "el", "ell"],
  M: ["m", "em"],
  N: ["n", "en"],
  O: ["o", "oh", "owe"],
  P: ["p", "pee", "pea"],
  Q: ["q", "cue", "queue", "kew"],
  R: ["r", "ar", "are"],
  S: ["s", "es", "ess"],
  T: ["t", "tee", "tea"],
  U: ["u", "you", "yew"],
  V: ["v", "vee"],
  W: ["w", "double you", "double u", "doubleyou"],
  X: ["x", "ex", "eks"],
  Y: ["y", "why", "wye"],
  Z: ["z", "zee", "zed"],
};

function tokensOf(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(the|letter|capital|uppercase|please|say|it|is)\b/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function containsPhrase(tokens: string[], phrase: string): boolean {
  const parts = phrase.split(" ");
  for (let i = 0; i <= tokens.length - parts.length; i++) {
    if (parts.every((word, j) => tokens[i + j] === word)) return true;
  }
  return false;
}

/** Match a spoken letter name. Long sentences are ignored so background talk does not advance. */
export function matchesLetter(letter: string, transcript: string): boolean {
  const aliases = ALIASES[letter] ?? [letter.toLowerCase()];
  const tokens = tokensOf(transcript);
  if (tokens.length === 0 || tokens.length > 3) {
    const whole = tokens.join(" ");
    return aliases.some((alias) => whole === alias);
  }
  return aliases.some((alias) => containsPhrase(tokens, alias) || tokens.join("") === alias.replace(/\s/g, ""));
}
