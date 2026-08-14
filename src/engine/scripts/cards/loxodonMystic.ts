// `Loxodon Mystic` — "{W}, {T}: Tap target creature." The activated
// targeted tap behind a coloured pip. M6.4ac, D185.

import { LOXODON_MYSTIC } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LOXODON_MYSTIC, '{W}, {T}: Tap target creature.');

export const LOXODON_MYSTIC_SCRIPT: CardScript = {
  oracleId: LOXODON_MYSTIC.oracleId,
  name: LOXODON_MYSTIC.name,
  activated: [
    {
      ref: `${LOXODON_MYSTIC.oracleId}#a0`,
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
