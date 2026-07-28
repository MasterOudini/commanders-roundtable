// Name folding for card lookup.
//
// ⚠️ SINGLE SOURCE OF TRUTH. The index keys and every query must be folded by the
// SAME function, or a lookup misses with no error — the card simply "doesn't
// exist". So this lives only here, in the worker, and the renderer never folds
// anything: it sends raw text over IPC and the worker folds both sides.
//
// What a decklist actually throws at us, and why each rule exists:
//   Æther Vial      → people type "Aether Vial". ⚠️ NFKD does NOT decompose Æ,
//                     so it needs its own alias pass BEFORE normalization.
//   Séance          → accented letters typed unaccented
//   Lim-Dûl's Vault → accent AND apostrophe; hyphen is meaningful, keep it
//   Jötun Grunt     → umlaut
//   Ghazbán Ogre    → acute
//   "Ach! Hans, Run!" → punctuation people omit
//   Sword of Feast and Famine vs "…Feast & Famine" → ampersand/and are NOT
//                     unified: that would collide distinct cards. Left alone.
//   curly ’ vs '    → unified
//   en/em dash      → folded to a plain hyphen

/** Digraphs NFKD leaves intact. Order matters: longest first. */
const DIGRAPHS = [
  ['Æ', 'AE'], ['æ', 'ae'],
  ['Œ', 'OE'], ['œ', 'oe'],
  ['ß', 'ss'],
  ['Ø', 'O'], ['ø', 'o'],   // NFKD leaves the stroke attached
  ['Đ', 'D'], ['đ', 'd'],
  ['Ł', 'L'], ['ł', 'l'],
  ['Þ', 'th'], ['þ', 'th'],
];

/** Punctuation dropped entirely — people omit it inconsistently. */
const DROPPED = /[.,'"!?:;()[\]{}]/g;

/**
 * Dash-like characters that all mean "hyphen" to a person typing a decklist:
 * hyphen/non-breaking hyphen/figure/en/em/horizontal-bar, plus minus sign.
 * Written as escapes on purpose — a literal character class here is invisible in
 * a diff and easy to corrupt through a copy-paste or an encoding change.
 */
const DASHES = /[‐-―⁃−]/g;

/** Quote-like characters unified before DROPPED removes them. */
const QUOTES = /[‘’‚‛“”„‟«»‹›]/g;

/** Combining diacritical marks, left behind by NFKD decomposition. */
const COMBINING = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃰︠-︯]/g;

/**
 * Fold a card name to its lookup key.
 *
 * Idempotent: fold(fold(x)) === fold(x). Worth preserving — the index is built
 * from folded keys and queried with folded input, and a non-idempotent fold makes
 * a re-index subtly change what resolves.
 */
function foldName(input) {
  if (typeof input !== 'string') return '';

  let s = input;
  for (const [from, to] of DIGRAPHS) {
    if (s.includes(from)) s = s.split(from).join(to);
  }

  s = s
    .replace(QUOTES, "'")
    .replace(DASHES, '-')
    // Strip combining marks after decomposition: é → e, û → u, ñ → n.
    .normalize('NFKD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(DROPPED, '')
    // Collapse any run of whitespace, including the spaces around a DFC's '//'.
    .replace(/\s+/g, ' ')
    .trim();

  return s;
}

/**
 * The front-face key for a multi-face name.
 * 'Fire // Ice' → 'fire', so a decklist naming only the front face resolves.
 */
function frontFaceKey(name) {
  const folded = foldName(name);
  const cut = folded.indexOf(' // ');
  return cut === -1 ? folded : folded.slice(0, cut);
}

module.exports = { foldName, frontFaceKey };
