// `Kor Line-Slinger` — "{T}: Tap target creature with power 3 or less."
// The activated tap behind D139's numeric CEILING (the floor's mirror).
// M6.4ab, D184.

import { KOR_LINE_SLINGER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(KOR_LINE_SLINGER, '{T}: Tap target creature with power 3 or less.');

export const KOR_LINE_SLINGER_SCRIPT: CardScript = {
  oracleId: KOR_LINE_SLINGER.oracleId,
  name: KOR_LINE_SLINGER.name,
  activated: [
    {
      ref: `${KOR_LINE_SLINGER.oracleId}#a0`,
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
