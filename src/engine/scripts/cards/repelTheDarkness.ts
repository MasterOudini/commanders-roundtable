// `Repel the Darkness` — tap up to two target creatures; I draw either way.

import { REPEL_THE_DARKNESS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(REPEL_THE_DARKNESS, 'Tap up to two target creatures.\nDraw a card.');

export const REPEL_THE_DARKNESS_SCRIPT: CardScript = {
  oracleId: REPEL_THE_DARKNESS.oracleId,
  name: REPEL_THE_DARKNESS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const cards: string[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) continue;
        cards.push(target.id);
      }
      const events: EventBody[] = [];
      if (cards.length > 0) events.push({ t: 'PermanentsTapped', cards });
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
