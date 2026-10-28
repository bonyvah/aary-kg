/**
 * Fuzzy search for lists on the staff screens (quizzes, users, contests...).
 *
 * - The script doesn't matter: Kyrgyz, Russian and Latin letters are folded to one spelling, so
 *   «Өмүрбек», «Омурбек» and «omurbek» are the same word.
 * - Typos are forgiven: about one wrong, missing or extra letter per four letters of a word.
 * - Every word of the query must be found somewhere in the text, in any order.
 */

const FOLD: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", э: "e", ж: "zh", з: "z", и: "i", й: "i", ы: "i",
  к: "k", л: "l", м: "m", н: "n", ң: "ng", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ү: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ь: "", ю: "yu", я: "ya",
  á: "a", à: "a", ä: "a", é: "e", è: "e", ë: "e", í: "i", ï: "i", ó: "o", ö: "o", ú: "u", ü: "u",
};

/** Lowercased, letters folded to one spelling, anything else a space: words separated by single spaces. */
export function fold(text: string): string {
  let out = "";
  for (const char of text.toLowerCase()) {
    if (char in FOLD) out += FOLD[char];
    else if ((char >= "a" && char <= "z") || (char >= "0" && char <= "9")) out += char;
    else out += " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

/** How many mistakes a query word of this length may have: none up to 3 letters, then 1 per 4, at most 2. */
const budget = (length: number) => (length <= 3 ? 0 : Math.min(2, Math.floor(length / 4)));

/** Fewest edits to make `word` appear somewhere in `text` (Sellers' approximate substring match). */
function substringDistance(word: string, text: string): number {
  let previous = new Array<number>(text.length + 1).fill(0);
  for (let i = 1; i <= word.length; i++) {
    const current = [i];
    for (let j = 1; j <= text.length; j++) {
      const cost = word[i - 1] === text[j - 1] ? 0 : 1;
      current.push(Math.min(previous[j - 1]! + cost, previous[j]! + 1, current[j - 1]! + 1));
    }
    previous = current;
  }
  return Math.min(...previous);
}

/**
 * How well `text` answers `query`: 0 = not at all, higher = better. An empty query scores 1 for everything.
 * Exact words beat word starts, which beat matches inside words, which beat matches with typos.
 */
export function score(text: string, query: string): number {
  const words = fold(query).split(" ").filter(Boolean);
  if (words.length === 0) return 1;
  const haystack = fold(text);
  const own = ` ${haystack} `;
  let total = 0;
  for (const word of words) {
    if (own.includes(` ${word} `)) total += 4;
    else if (own.includes(` ${word}`)) total += 3;
    else if (haystack.includes(word)) total += 2;
    else {
      const distance = substringDistance(word, haystack);
      if (distance > budget(word.length)) return 0;
      total += 1 - distance / (word.length + 1);
    }
  }
  return total / words.length;
}

/** Whether `text` matches every word of `query`. */
export function matches(text: string, query: string): boolean {
  return score(text, query) > 0;
}

/**
 * The items that match, best first (the original order among equals). An empty query keeps all, in order.
 * `fields`: the texts of an item to search, e.g. its name and login.
 */
export function search<T>(items: readonly T[], query: string, fields: (item: T) => string[]): T[] {
  if (fold(query) === "") return [...items];
  return items
    .map((item, index) => ({ item, index, score: Math.max(0, ...fields(item).map((field) => score(field, query))) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}
