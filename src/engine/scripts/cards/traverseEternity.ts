// `Traverse Eternity` — the historic filter (D208's CR 700.10 read, off the
// derived type line) composed with the greatest-mana-value census (D242) as a
// draw count. No historic permanents is a true no-op. D262.

import { TRAVERSE_ETERNITY } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(
  TRAVERSE_ETERNITY,
  'Draw cards equal to the greatest mana value among historic permanents you control. (Artifacts, legendaries, and Sagas are historic.)',
);

export const TRAVERSE_ETERNITY_SCRIPT: CardScript = {
  oracleId: TRAVERSE_ETERNITY.oracleId,
  name: TRAVERSE_ETERNITY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let best = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        const tl = ctx.derive(id).typeLine;
        const historic =
          tl.types.includes('Artifact') ||
          tl.supertypes.includes('Legendary') ||
          tl.subtypes.includes('Saga');
        if (!historic) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (oc && oc.manaValue > best) best = oc.manaValue;
      }
      if (best <= 0) return [];
      return [...drawEvents(ctx.state, obj.controller, best)];
    },
  },
};
