// `Union of the Third Path` — draw a card, THEN gain life equal to the hand.
//
// ⚠️⚠️ THE COUNT INCLUDES THE CARD JUST DRAWN, and `ctx.state` is the
// PRE-resolution board — so the hand size has to be read as `hand.length + 1`
// by hand. This is D260's Tidy Conclusion rule with the sign reversed: there
// the census had to EXCLUDE what the first sentence removed, here it must
// INCLUDE what the first sentence added. Same missing engine door (D261 — a
// resolve cannot see its own effects), same manual fix.
// ⚠️ And the +1 is conditional on the draw ACTUALLY happening: an empty
// library draws nothing (the loss is the draw rule's business, D158), so the
// count is taken off the events this resolve emits rather than assumed. D264.

import { UNION_OF_THE_THIRD_PATH } from '../../../data/fixtures/engineCards';
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
  UNION_OF_THE_THIRD_PATH,
  'Draw a card, then you gain life equal to the number of cards in your hand.',
);

export const UNION_OF_THE_THIRD_PATH_SCRIPT: CardScript = {
  oracleId: UNION_OF_THE_THIRD_PATH.oracleId,
  name: UNION_OF_THE_THIRD_PATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const draws = drawEvents(ctx.state, obj.controller, 1);
      const events: EventBody[] = [...draws];

      // How many cards the draw actually moved into my hand.
      let drawn = 0;
      for (const e of draws) {
        if (e.t !== 'CardsMoved') continue;
        drawn += e.moves.filter(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === obj.controller,
        ).length;
      }

      const hand = (ctx.state.zones.hand[obj.controller] ?? []).length + drawn;
      if (hand <= 0) return events;
      const me = ctx.state.players[obj.controller];
      if (!me || me.hasLost) return events;
      events.push({ t: 'LifeChanged', player: obj.controller, delta: hand, to: me.life + hand });
      return events;
    },
  },
};
