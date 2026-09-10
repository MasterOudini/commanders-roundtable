// `Fire Nation Archers` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRE_NATION_ARCHERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRE_NATION_ARCHERS, "Reach (This creature can block creatures with flying.)\n{5}: This creature deals 2 damage to each opponent. Create a 2/2 red Soldier creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 2 damage to each opponent. Create a 2/2 red Soldier creature token.", FIRE_NATION_ARCHERS.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 2 damage to each opponent. Create a 2/2 red Soldier creature token.");

export const FIRE_NATION_ARCHERS_SCRIPT: CardScript = {
  oracleId: FIRE_NATION_ARCHERS.oracleId,
  name: FIRE_NATION_ARCHERS.name,
  activated: [
    {
      ref: `${FIRE_NATION_ARCHERS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
