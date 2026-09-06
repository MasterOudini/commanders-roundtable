// `Draconian Cylix` - an activation regenerateTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRACONIAN_CYLIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRACONIAN_CYLIX, "{2}, {T}, Discard a card at random: Regenerate target creature.");

export const DRACONIAN_CYLIX_SCRIPT: CardScript = {
  oracleId: DRACONIAN_CYLIX.oracleId,
  name: DRACONIAN_CYLIX.name,
  activated: [
    {
      ref: `${DRACONIAN_CYLIX.oracleId}#a0`,
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
