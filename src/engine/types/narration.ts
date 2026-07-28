// The shape of one narration fragment.
//
// Here rather than in `../narrate.ts` because both `events.ts` and `state.ts`
// need it, and `narrate.ts` needs `EventBody` — a type in `types/` keeps that
// from becoming a cycle. The builders and the renderer live in `../narrate.ts`;
// read the comment at the top of that file for why a line is not a string.

import type { PlayerId } from './ids';

/**
 * `lit` is text that reads the same to everyone. `of` marks a fragment that is
 * ABOUT a player: `third` is how it reads to anybody else, `second` is how it
 * reads to that player. A name, a possessive, a pronoun and a verb are all this
 * one shape.
 */
export type NarrationPart =
  | { readonly lit: string }
  | { readonly of: PlayerId; readonly third: string; readonly second: string };
