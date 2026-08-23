// `Voyaging Satyr` — an EXACT-TEXT TWIN of the shipped `Blossom Dryad`
// (D-batch), one oracle id over: "{T}: Untap target land." Written to the same
// shape deliberately, so the twin sweep finds a pair and not a divergence.
// D267.

import { VOYAGING_SATYR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VOYAGING_SATYR, '{T}: Untap target land.');

export const VOYAGING_SATYR_SCRIPT: CardScript = {
  oracleId: VOYAGING_SATYR.oracleId,
  name: VOYAGING_SATYR.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${VOYAGING_SATYR.oracleId}#a0`,
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
