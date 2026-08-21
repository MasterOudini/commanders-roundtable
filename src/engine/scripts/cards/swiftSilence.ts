// `Swift Silence` — the FIRST mass counter: every OTHER spell on the stack
// dies and the caster draws one per kill. "Other" excludes Swift Silence
// itself, which is still on the stack while it resolves — the same fact
// Rite of Flame's self-name census leans on (D240). D256.

import { SWIFT_SILENCE } from '../../../data/fixtures/engineCards';
import { drawEvents, moveFromStack } from '../../effects';
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
  SWIFT_SILENCE,
  'Counter all other spells. Draw a card for each spell countered this way.',
);

export const SWIFT_SILENCE_SCRIPT: CardScript = {
  oracleId: SWIFT_SILENCE.oracleId,
  name: SWIFT_SILENCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      let countered = 0;
      for (const o of ctx.state.stack) {
        if (o.kind !== 'spell') continue;
        if (o.id === obj.id) continue;
        events.push({ t: 'SpellCountered', stackId: o.id });
        if (o.card) {
          const vc = ctx.state.cards[o.card];
          if (vc) events.push(moveFromStack(o.card, 'graveyard', vc.owner));
        }
        countered += 1;
      }
      if (countered > 0) events.push(...drawEvents(ctx.state, obj.controller, countered));
      return events;
    },
  },
};
