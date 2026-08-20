// `Blossoming Wreath` — "You gain life equal to the number of creature
// cards in your graveyard." The type comes off the ORACLE face (a graveyard
// card derives nothing — Desecrated Tomb's rule). D200.

import { BLOSSOMING_WREATH } from '../../../data/fixtures/engineCards';
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
  BLOSSOMING_WREATH,
  'You gain life equal to the number of creature cards in your graveyard.',
);

export const BLOSSOMING_WREATH_SCRIPT: CardScript = {
  oracleId: BLOSSOMING_WREATH.oracleId,
  name: BLOSSOMING_WREATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
        if (!oc) continue;
        if (faceOf(oc, card?.faceIndex ?? 0).typeLine.types.includes('Creature')) n++;
      }
      if (n === 0) return [];
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      return [{ t: 'LifeChanged', player: obj.controller, delta: n, to: life + n }];
    },
  },
};
