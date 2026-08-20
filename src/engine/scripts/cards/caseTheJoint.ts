// `Case the Joint` — "Draw two cards, then look at the top card of each
// player's library." The look is a reveal TO THE CASTER of each library's
// top — information, not a decision; the projection boundary is exactly
// `revealedTo`. The draws come FIRST, so the caster's own revealed top is
// the post-draw one. D202.

import { CASE_THE_JOINT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { apply } from '../../reducer';
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

const TEXT = printed(CASE_THE_JOINT, "Draw two cards, then look at the top card of each player's library.");

export const CASE_THE_JOINT_SCRIPT: CardScript = {
  oracleId: CASE_THE_JOINT.oracleId,
  name: CASE_THE_JOINT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 2)];
      // The look happens AFTER the draws — fold them through the pure reducer
      // so the caster's own top is what it will actually be (D195's scratch
      // idiom).
      let scratch = ctx.state;
      for (const body of events) {
        scratch = apply(scratch, {
          seq: scratch.eventCount,
          body,
          cause: { kind: 'system' },
        } as never);
      }
      const tops = [];
      for (const pid of scratch.seating) {
        if (scratch.players[pid]?.hasLost) continue;
        const lib = scratch.zones.library[pid] ?? [];
        const top = lib[lib.length - 1];
        if (top !== undefined) tops.push(top);
      }
      if (tops.length > 0) events.push({ t: 'CardsRevealed', cards: tops, to: [obj.controller] });
      return events;
    },
  },
};
