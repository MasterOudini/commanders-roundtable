// `Fire Shrine Keeper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRE_SHRINE_KEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRE_SHRINE_KEEPER, "Menace\n{7}{R}, {T}, Sacrifice this creature: It deals 3 damage to each of up to two target creatures.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 3 damage to each of up to two target creatures.", FIRE_SHRINE_KEEPER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 3 damage to each of up to two target creatures.");

export const FIRE_SHRINE_KEEPER_SCRIPT: CardScript = {
  oracleId: FIRE_SHRINE_KEEPER.oracleId,
  name: FIRE_SHRINE_KEEPER.name,
  activated: [
    {
      ref: `${FIRE_SHRINE_KEEPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
