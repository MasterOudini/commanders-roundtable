// `Prologue to Phyresis` — "Each opponent gets a poison counter.\nDraw a
// card." The FIRST script to emit PoisonChanged directly (until now poison
// arrived only through infect and toxic damage): one event per opponent
// still in the game, then the draw. D279.

import { PROLOGUE_TO_PHYRESIS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PROLOGUE_TO_PHYRESIS, 'Each opponent gets a poison counter.\nDraw a card.');

export const PROLOGUE_TO_PHYRESIS_SCRIPT: CardScript = {
  oracleId: PROLOGUE_TO_PHYRESIS.oracleId,
  name: PROLOGUE_TO_PHYRESIS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const [id, p] of Object.entries(ctx.state.players)) {
        if (id === obj.controller || !p || p.hasLost) continue;
        events.push({ t: 'PoisonChanged', player: id, delta: 1, to: p.poison + 1 });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
