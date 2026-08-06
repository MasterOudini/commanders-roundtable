// `Elite Arrester` — "{1}{U}, {T}: Tap target creature." Auriok
// Transfixer's tap with a mana rider — a turned target gets no event
// (the untap guard's mirror, D162). M6.4q, D173.

import { ELITE_ARRESTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ELITE_ARRESTER, '{1}{U}, {T}: Tap target creature.');

export const ELITE_ARRESTER_SCRIPT: CardScript = {
  oracleId: ELITE_ARRESTER.oracleId,
  name: ELITE_ARRESTER.name,
  activated: [
    {
      ref: `${ELITE_ARRESTER.oracleId}#a0`,
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
