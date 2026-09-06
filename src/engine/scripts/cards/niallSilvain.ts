// `Niall Silvain` - an activation regenerateTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIALL_SILVAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIALL_SILVAIN, "{G}{G}{G}{G}, {T}: Regenerate target creature.");

export const NIALL_SILVAIN_SCRIPT: CardScript = {
  oracleId: NIALL_SILVAIN.oracleId,
  name: NIALL_SILVAIN.name,
  activated: [
    {
      ref: `${NIALL_SILVAIN.oracleId}#a0`,
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
