// `Broken Fall` - an activation regenerateTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BROKEN_FALL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BROKEN_FALL, "Return this enchantment to its owner's hand: Regenerate target creature.");

export const BROKEN_FALL_SCRIPT: CardScript = {
  oracleId: BROKEN_FALL.oracleId,
  name: BROKEN_FALL.name,
  activated: [
    {
      ref: `${BROKEN_FALL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: target.id }];
      },
    },
  ],
};
