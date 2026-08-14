// `Galvanic Key` — "{3}, {T}: Untap target artifact." Line 1 is Flash
// (Tier 2, cast timing); the def owes the untap alone — Filigree Sages'
// shape with a tap in the cost. M6.4t, D176.

import { GALVANIC_KEY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GALVANIC_KEY, 'Flash\n{3}, {T}: Untap target artifact.');
const TEXT = PRINTED.split('\n')[1] as string;

export const GALVANIC_KEY_SCRIPT: CardScript = {
  oracleId: GALVANIC_KEY.oracleId,
  name: GALVANIC_KEY.name,
  activated: [
    {
      // The Flash line has no colon, so the untap is activated index 0.
      ref: `${GALVANIC_KEY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || !card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
