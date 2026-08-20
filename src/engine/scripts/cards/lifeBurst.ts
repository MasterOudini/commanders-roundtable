// `Life Burst` — 4, plus 4 more per namesake in every graveyard. D222.

import { LIFE_BURST } from '../../../data/fixtures/engineCards';
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
  LIFE_BURST,
  'Target player gains 4 life, then gains 4 life for each card named Life Burst in each graveyard.',
);

export const LIFE_BURST_SCRIPT: CardScript = {
  oracleId: LIFE_BURST.oracleId,
  name: LIFE_BURST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      let named = 0;
      for (const pid of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[pid] ?? []) {
          const card = ctx.state.cards[id];
          if (!card) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name === 'Life Burst') named++;
        }
      }
      const gain = 4 + 4 * named;
      return [{ t: 'LifeChanged', player: target.id, delta: gain, to: p.life + gain }];
    },
  },
};
