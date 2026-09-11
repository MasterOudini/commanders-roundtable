// `Shambling Vent` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHAMBLING_VENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHAMBLING_VENT, "This land enters tapped.\n{T}: Add {W} or {B}.\n{1}{W}{B}: Until end of turn, this land becomes a 2/3 white and black Elemental creature with lifelink. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Until end of turn, this land becomes a 2/3 white and black Elemental creature with lifelink. It's still a land.", SHAMBLING_VENT.name);
const VOCAB_T_A1 = vocabularyTargets("Until end of turn, this land becomes a 2/3 white and black Elemental creature with lifelink. It's still a land.");

export const SHAMBLING_VENT_SCRIPT: CardScript = {
  oracleId: SHAMBLING_VENT.oracleId,
  name: SHAMBLING_VENT.name,
  activated: [
    {
      ref: `${SHAMBLING_VENT.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
