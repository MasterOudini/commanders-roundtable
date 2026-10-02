// `Bosh, Iron Golem` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOSH_IRON_GOLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOSH_IRON_GOLEM, "Trample\n{3}{R}, Sacrifice an artifact: Bosh deals damage equal to the sacrificed artifact's mana value to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to the sacrificed artifact's mana value to any target.", BOSH_IRON_GOLEM.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to the sacrificed artifact's mana value to any target.");

export const BOSH_IRON_GOLEM_SCRIPT: CardScript = {
  oracleId: BOSH_IRON_GOLEM.oracleId,
  name: BOSH_IRON_GOLEM.name,
  activated: [
    {
      ref: `${BOSH_IRON_GOLEM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
