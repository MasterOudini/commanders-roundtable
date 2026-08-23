// `Trip Noose` — the {2}, {T} tap (Scepter of Dominance D243's shape, one
// noun narrower). A target already turned gets no event. D262.

import { TRIP_NOOSE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TRIP_NOOSE, '{2}, {T}: Tap target creature.');

export const TRIP_NOOSE_SCRIPT: CardScript = {
  oracleId: TRIP_NOOSE.oracleId,
  name: TRIP_NOOSE.name,
  activated: [
    {
      ref: `${TRIP_NOOSE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
        if (card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
