// `Arbalest Elite` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARBALEST_ELITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARBALEST_ELITE, "{2}{W}, {T}: This creature deals 3 damage to target attacking or blocking creature. This creature doesn't untap during your next untap step.");

const VOCAB_A0 = vocabularyEffects("~ deals 3 damage to target attacking or blocking creature. ~ doesn't untap during your next untap step.", ARBALEST_ELITE.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 3 damage to target attacking or blocking creature. ~ doesn't untap during your next untap step.");

export const ARBALEST_ELITE_SCRIPT: CardScript = {
  oracleId: ARBALEST_ELITE.oracleId,
  name: ARBALEST_ELITE.name,
  activated: [
    {
      ref: `${ARBALEST_ELITE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
