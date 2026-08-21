// `Sacred Armory` — "{2}: Target creature gets +1/+0 until end of turn."
// The mana-only activated pump, no tap. D242.

import { SACRED_ARMORY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(SACRED_ARMORY, '{2}: Target creature gets +1/+0 until end of turn.');

export const SACRED_ARMORY_SCRIPT: CardScript = {
  oracleId: SACRED_ARMORY.oracleId,
  name: SACRED_ARMORY.name,
  activated: [
    {
      ref: `${SACRED_ARMORY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 0 }];
      },
    },
  ],
};
