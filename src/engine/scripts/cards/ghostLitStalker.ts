// `Ghost-Lit Stalker` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOST_LIT_STALKER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(GHOST_LIT_STALKER, "{4}{B}, {T}: Target player discards two cards. Activate only as a sorcery.\nChannel — {5}{B}{B}, Discard this card: Target player discards four cards. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player discards two cards.", GHOST_LIT_STALKER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards two cards.");
const VOCAB_A1 = vocabularyEffects("Target player discards four cards.", GHOST_LIT_STALKER.name);
const VOCAB_T_A1 = vocabularyTargets("Target player discards four cards.");

export const GHOST_LIT_STALKER_SCRIPT: CardScript = {
  oracleId: GHOST_LIT_STALKER.oracleId,
  name: GHOST_LIT_STALKER.name,
  activated: [
    {
      ref: `${GHOST_LIT_STALKER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${GHOST_LIT_STALKER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
