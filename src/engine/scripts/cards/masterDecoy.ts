// `Master Decoy` — "{W}, {T}: Tap target creature." The FIFTH oracle id on
// the Benalish Trapper text (Trapper, Blinding Mage, Gideon's Lawkeeper,
// Goldmeadow Harrier before it), proven on its own id. M6.4ad, D186.

import { MASTER_DECOY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MASTER_DECOY, '{W}, {T}: Tap target creature.');

export const MASTER_DECOY_SCRIPT: CardScript = {
  oracleId: MASTER_DECOY.oracleId,
  name: MASTER_DECOY.name,
  activated: [
    {
      ref: `${MASTER_DECOY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
