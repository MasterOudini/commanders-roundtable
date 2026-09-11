// `Hateflayer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HATEFLAYER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HATEFLAYER, "Wither (This deals damage to creatures in the form of -1/-1 counters.)\n{2}{R}, {Q}: This creature deals damage equal to its power to any target. ({Q} is the untap symbol.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to its power to any target.", HATEFLAYER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to its power to any target.");

export const HATEFLAYER_SCRIPT: CardScript = {
  oracleId: HATEFLAYER.oracleId,
  name: HATEFLAYER.name,
  activated: [
    {
      ref: `${HATEFLAYER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
