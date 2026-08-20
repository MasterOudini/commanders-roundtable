// `Pacification Array` — "{2}, {T}: Tap target artifact or creature." The
// Trapper tap behind the Icy compound. D231.

import { PACIFICATION_ARRAY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PACIFICATION_ARRAY, '{2}, {T}: Tap target artifact or creature.');

export const PACIFICATION_ARRAY_SCRIPT: CardScript = {
  oracleId: PACIFICATION_ARRAY.oracleId,
  name: PACIFICATION_ARRAY.name,
  activated: [
    {
      ref: `${PACIFICATION_ARRAY.oracleId}#a0`,
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
