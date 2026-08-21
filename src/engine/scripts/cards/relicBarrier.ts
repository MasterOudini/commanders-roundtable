// `Relic Barrier` — "{T}: Tap target artifact." The Trapper line for
// machines. D239.

import { RELIC_BARRIER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RELIC_BARRIER, '{T}: Tap target artifact.');

export const RELIC_BARRIER_SCRIPT: CardScript = {
  oracleId: RELIC_BARRIER.oracleId,
  name: RELIC_BARRIER.name,
  activated: [
    {
      ref: `${RELIC_BARRIER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
