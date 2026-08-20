// `Cosmic Epiphany` — "Draw cards equal to the number of instant and
// sorcery cards in your graveyard." Oracle-face types over my graveyard.
// D205.

import { COSMIC_EPIPHANY } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { faceOf } from '../../oracle';
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
  COSMIC_EPIPHANY,
  'Draw cards equal to the number of instant and sorcery cards in your graveyard.',
);

export const COSMIC_EPIPHANY_SCRIPT: CardScript = {
  oracleId: COSMIC_EPIPHANY.oracleId,
  name: COSMIC_EPIPHANY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
        if (!oc) continue;
        const types = faceOf(oc, card?.faceIndex ?? 0).typeLine.types;
        if (types.includes('Instant') || types.includes('Sorcery')) n++;
      }
      if (n === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
