// `Fume Spitter` — "Sacrifice this creature: Put a -1/-1 counter on target
// creature." Bile Urchin's mana-free self-sacrifice (D164) with a creature
// target and a counter payload. M6.4t, D176.

import { FUME_SPITTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FUME_SPITTER, 'Sacrifice this creature: Put a -1/-1 counter on target creature.');

export const FUME_SPITTER_SCRIPT: CardScript = {
  oracleId: FUME_SPITTER.oracleId,
  name: FUME_SPITTER.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${FUME_SPITTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '-1/-1', delta: 1 }] }];
      },
    },
  ],
};
