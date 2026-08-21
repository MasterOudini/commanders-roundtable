// `Rathi Trapper` — "{B}, {T}: Tap target creature." The Trapper family
// with a mana surcharge — its own printed line, not the eight-id text.
// D237.

import { RATHI_TRAPPER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RATHI_TRAPPER, '{B}, {T}: Tap target creature.');

export const RATHI_TRAPPER_SCRIPT: CardScript = {
  oracleId: RATHI_TRAPPER.oracleId,
  name: RATHI_TRAPPER.name,
  activated: [
    {
      ref: `${RATHI_TRAPPER.oracleId}#a0`,
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
