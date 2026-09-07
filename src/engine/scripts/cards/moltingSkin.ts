// `Molting Skin` - an activation regenerateTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOLTING_SKIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOLTING_SKIN, "Return this enchantment to its owner's hand: Regenerate target creature.");

export const MOLTING_SKIN_SCRIPT: CardScript = {
  oracleId: MOLTING_SKIN.oracleId,
  name: MOLTING_SKIN.name,
  activated: [
    {
      ref: `${MOLTING_SKIN.oracleId}#a0`,
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
