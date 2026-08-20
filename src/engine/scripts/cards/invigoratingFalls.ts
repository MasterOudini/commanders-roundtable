// `Invigorating Falls` — gain 1 per creature card in EVERY graveyard.
// D220.

import { INVIGORATING_FALLS } from '../../../data/fixtures/engineCards';
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
  INVIGORATING_FALLS,
  'You gain life equal to the number of creature cards in all graveyards.',
);

export const INVIGORATING_FALLS_SCRIPT: CardScript = {
  oracleId: INVIGORATING_FALLS.oracleId,
  name: INVIGORATING_FALLS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const pid of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[pid] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card && ctx.oracle.byPrinting(card.printingId);
          if (!oc) continue;
          if (faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Creature')) n++;
        }
      }
      const me = ctx.state.players[obj.controller];
      if (n === 0 || !me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: n, to: me.life + n }];
    },
  },
};
