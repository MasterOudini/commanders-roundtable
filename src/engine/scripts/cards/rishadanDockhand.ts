// `Rishadan Dockhand` — "Islandwalk (…) / {1}, {T}: Tap target land."
// The Trapper tap aimed at a LAND; the keyword-and-reminder line never
// counts, so the ability is #a0. D240.

import { RISHADAN_DOCKHAND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  RISHADAN_DOCKHAND,
  "Islandwalk (This creature can't be blocked as long as defending player controls an Island.)\n{1}, {T}: Tap target land.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const RISHADAN_DOCKHAND_SCRIPT: CardScript = {
  oracleId: RISHADAN_DOCKHAND.oracleId,
  name: RISHADAN_DOCKHAND.name,
  activated: [
    {
      ref: `${RISHADAN_DOCKHAND.oracleId}#a0`,
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
