// `Lucid Dreams` — draw X where X counts the distinct CARD TYPES in my
// graveyard. D223.

import { LUCID_DREAMS } from '../../../data/fixtures/engineCards';
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
  LUCID_DREAMS,
  'Draw X cards, where X is the number of card types among cards in your graveyard.',
);

export const LUCID_DREAMS_SCRIPT: CardScript = {
  oracleId: LUCID_DREAMS.oracleId,
  name: LUCID_DREAMS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const types = new Set<string>();
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        for (const t of faceOf(oc, card.faceIndex ?? 0).typeLine.types) types.add(t);
      }
      if (types.size === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, types.size)];
    },
  },
};
