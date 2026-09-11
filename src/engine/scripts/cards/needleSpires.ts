// `Needle Spires` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NEEDLE_SPIRES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NEEDLE_SPIRES, "This land enters tapped.\n{T}: Add {R} or {W}.\n{2}{R}{W}: Until end of turn, this land becomes a 2/1 red and white Elemental creature with double strike. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Until end of turn, this land becomes a 2/1 red and white Elemental creature with double strike. It's still a land.", NEEDLE_SPIRES.name);
const VOCAB_T_A1 = vocabularyTargets("Until end of turn, this land becomes a 2/1 red and white Elemental creature with double strike. It's still a land.");

export const NEEDLE_SPIRES_SCRIPT: CardScript = {
  oracleId: NEEDLE_SPIRES.oracleId,
  name: NEEDLE_SPIRES.name,
  activated: [
    {
      ref: `${NEEDLE_SPIRES.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
