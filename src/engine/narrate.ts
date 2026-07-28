// Narration that can be read in the second person without the engine knowing
// who is reading.
//
// ⚠️ THE ENGINE MUST NOT KNOW WHO "YOU" IS. The same narration is projected to
// every seat, and in multiplayer each client sees a different seat as itself —
// so a second-person sentence cannot be baked in here. A solo game makes that
// sharper rather than softer: it is a hotseat (D42), so the one viewer ROTATES
// across all four seats and "you" changes meaning mid-game.
//
// So a line is not a string. It is a list of PARTS, and there is exactly one
// primitive: a fragment that reads one way normally and another way when the
// reader is the player it is about.
//
//     n`${who(state, ap)} ${vb(ap, 'draws', 'draw')} a card.`
//
//     third person → "Ana draws a card."
//     read by Ana  → "You draw a card."
//
// ⚠️ NO ENGLISH MORPHOLOGY ANYWHERE. Both forms of every fragment are written
// out at the call site. Deriving "draw" from "draws" needs a de-inflector, and
// an English de-inflector is a pile of special cases that gets `loses`→`los`,
// `dies`→`dy` and `goes`→`goe` wrong in ways nobody notices until a player sees
// one. Two words at the call site costs a few characters and cannot be wrong.
//
// ⚠️ `NarrationLine.text` is DERIVED from the parts, by `narrated()`, and is
// never written by hand. It is the canonical third-person rendering — what goes
// on disk in the NDJSON log, what the state hash covers, and what a spectator
// reads. Two hand-written representations of one sentence would drift, and the
// drift would show up as a log that disagrees with itself.

import type { ColorLetter } from '../data/cardTypes';
import type { EventBody } from './types/events';
import type { PlayerId } from './types/ids';
import type { NarrationPart } from './types/narration';
import type { GameState } from './types/state';

export type { NarrationPart };

/** The low-level constructor. Everything below is sugar over it. */
export function ref(of: PlayerId, third: string, second: string): NarrationPart {
  return { of, third, second };
}

function nameIn(state: GameState, p: PlayerId): string {
  // ⚠️ `?? p` matches what every call site did before parts existed, so a line
  // about a player who has somehow left the state still says something.
  return state.players[p]?.name ?? p;
}

/** "Ana" / "you" — a player as a subject or an object. */
export function who(state: GameState, p: PlayerId): NarrationPart {
  return ref(p, nameIn(state, p), 'you');
}

/** "Ana's" / "your". */
export function whose(state: GameState, p: PlayerId): NarrationPart {
  return ref(p, `${nameIn(state, p)}'s`, 'your');
}

/** "their" / "your" — the possessive pronoun, when the line already named them. */
export function their(p: PlayerId): NarrationPart {
  return ref(p, 'their', 'your');
}

/** "they" / "you" — the nominative pronoun. Capitalised by position, not here. */
export function they(p: PlayerId): NarrationPart {
  return ref(p, 'they', 'you');
}

/** "themselves" / "yourself". */
export function themself(p: PlayerId): NarrationPart {
  return ref(p, 'themselves', 'yourself');
}

/**
 * A player as the OBJECT of a sentence whose subject is `actor` — reflexive when
 * they are the same player.
 *
 * ⚠️ Necessary, not decorative. A Tier-3 tool used on yourself produced "Ana sets
 * Ana to 37 life." before parts existed, and the plain object form would have
 * turned that into "You set you to 37 life." — trading one broken sentence for
 * another. Both persons read correctly only if the reflexive is chosen here, and
 * only the call site knows who the subject is.
 */
export function whoElse(state: GameState, actor: PlayerId, target: PlayerId): NarrationPart {
  return actor === target ? themself(target) : who(state, target);
}

/** The possessive of the same: "their own library" / "your library". */
export function whoseElse(state: GameState, actor: PlayerId, target: PlayerId): NarrationPart {
  return actor === target ? ref(target, 'their own', 'your') : whose(state, target);
}

/**
 * A verb, agreeing with `p`.
 *
 * ⚠️ The player is named explicitly rather than inferred from the nearest
 * preceding part. Inference is right almost always, and "almost always" in a
 * sentence like "Ana passed for Ben, who is disconnected" is a verb agreeing
 * with the wrong seat.
 */
export function vb(p: PlayerId, third: string, second: string): NarrationPart {
  return ref(p, third, second);
}

/**
 * Build a line. A tagged template so a call site reads as the sentence it is:
 * the literal text carries its own spacing and punctuation, and only the
 * player-dependent fragments are interpolated.
 *
 * Interpolated strings and numbers become literals, so an existing
 * `${count} card${count === 1 ? '' : 's'}` needs no thought.
 */
export function n(
  strings: TemplateStringsArray,
  ...values: readonly (NarrationPart | string | number)[]
): NarrationPart[] {
  const out: NarrationPart[] = [];
  for (let i = 0; i < strings.length; i++) {
    push(out, strings[i] ?? '');
    if (i < values.length) {
      const v = values[i];
      if (typeof v === 'string' || typeof v === 'number') push(out, String(v));
      else if (v) out.push(v);
    }
  }
  return out;
}

/**
 * Append a literal, merging into the previous one.
 *
 * ⚠️ Merging is a NORMALISATION, not an optimisation: parts live in `GameState`
 * and therefore in the state hash, so two ways of writing the same sentence must
 * produce the same parts. It also keeps the on-disk log from growing a part per
 * template chunk.
 */
function push(out: NarrationPart[], text: string): void {
  if (text === '') return;
  const last = out[out.length - 1];
  if (last && 'lit' in last) out[out.length - 1] = { lit: last.lit + text };
  else out.push({ lit: text });
}

/**
 * Render a line for one reader. `me` is `null` for the canonical third-person
 * text — the NDJSON log, the state hash, a spectator.
 */
export function render(parts: readonly NarrationPart[], me: PlayerId | null): string {
  let out = '';
  for (const part of parts) {
    if ('lit' in part) {
      out += part.lit;
      continue;
    }
    const word = me !== null && part.of === me ? part.second : part.third;
    out += startsSentence(out) ? capitalise(word) : word;
  }
  return out;
}

/**
 * Whether what has been rendered so far leaves the next word at the start of a
 * sentence.
 *
 * ⚠️ ONE rule, here, rather than a capitalisation flag on every call site — a
 * flag is a thing 50 sites can each get wrong. The em dash counts because
 * "Turn 1 — Ana." is a label, and a label reads as "Turn 1 — You.".
 *
 * This applies to the third-person rendering too, and has to: `they()` is stored
 * lowercase, and "…first draw. They skip…" needs the capital in both persons.
 */
function startsSentence(sofar: string): boolean {
  return sofar === '' || /(?:[.!?]|—|:)\s$/.test(sofar);
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * A narration event.
 *
 * ⚠️ `player` is REQUIRED and positional, second, on purpose (D100). It is the
 * log's colour and therefore the answer to "who did that", which is the question
 * a four-player log is read for. An optional trailing parameter would have let
 * every call site that did not think about it default silently to a grey row.
 * Pass `null` only when the line genuinely belongs to nobody.
 *
 * ⚠️ `player` is the log's COLOUR and is NOT the sentence's subject. "Ana passed
 * for Ben, who is disconnected" is coloured Ben and its subject is Ana. Grammar
 * comes from the parts and from nowhere else.
 *
 * A plain string is still accepted, and is right for every line whose subject is
 * a card rather than a player — "Lightning Bolt resolves.", "No blocks." — which
 * read the same to everybody.
 */
export function narrated(
  line: string | readonly NarrationPart[],
  player: PlayerId | null,
  identity: readonly ColorLetter[] = [],
  manual = false,
): EventBody {
  const parts: readonly NarrationPart[] =
    typeof line === 'string' ? (line === '' ? [] : [{ lit: line }]) : line;
  return { t: 'Narrated', text: render(parts, null), player, identity, manual, parts };
}
