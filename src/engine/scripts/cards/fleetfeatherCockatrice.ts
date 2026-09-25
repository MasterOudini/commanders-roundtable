// `Fleetfeather Cockatrice` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLEETFEATHER_COCKATRICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLEETFEATHER_COCKATRICE, "Flash (You may cast this spell any time you could cast an instant.)\nFlying, deathtouch\n{5}{G}{U}: Monstrosity 3. (If this creature isn't monstrous, put three +1/+1 counters on it and it becomes monstrous.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Monstrosity 3.", FLEETFEATHER_COCKATRICE.name);
const VOCAB_T_A0 = vocabularyTargets("Monstrosity 3.");

export const FLEETFEATHER_COCKATRICE_SCRIPT: CardScript = {
  oracleId: FLEETFEATHER_COCKATRICE.oracleId,
  name: FLEETFEATHER_COCKATRICE.name,
  activated: [
    {
      ref: `${FLEETFEATHER_COCKATRICE.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
