// `He Who Hungers` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HE_WHO_HUNGERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HE_WHO_HUNGERS, "Flying\n{1}, Sacrifice a Spirit: Target opponent reveals their hand. You choose a card from it. That player discards that card. Activate only as a sorcery.\nSoulshift 4 (When this creature dies, you may return target Spirit card with mana value 4 or less from your graveyard to your hand.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target opponent reveals their hand. You choose a card from it. That player discards that card.", HE_WHO_HUNGERS.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent reveals their hand. You choose a card from it. That player discards that card.");

export const HE_WHO_HUNGERS_SCRIPT: CardScript = {
  oracleId: HE_WHO_HUNGERS.oracleId,
  name: HE_WHO_HUNGERS.name,
  activated: [
    {
      ref: `${HE_WHO_HUNGERS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
