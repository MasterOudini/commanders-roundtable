// `Wheel of Fortune` — "Each player discards their hand, then draws seven
// cards." A WHOLE hand is a discard with no choice (CR 701.8a — the same
// no-question rule the discard effect follows), so nothing asks; every
// discard lands in ONE CardsMoved and each player's seven come through
// `drawEvents` — THE one draw rule (D158), so the D189 markers fire and an
// emptied library still loses the game. Draws are computed from the
// PRE-state deliberately: hands moving to graveyards touch no library, so
// the four draw groups are independent. Turn order for the sequence, the
// caster's seat first in spirit — seating order is the deterministic
// stand-in APNAP allows here because no choices interleave. D196.

import { WHEEL_OF_FORTUNE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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

const TEXT = printed(WHEEL_OF_FORTUNE, 'Each player discards their hand, then draws seven cards.');

export const WHEEL_OF_FORTUNE_SCRIPT: CardScript = {
  oracleId: WHEEL_OF_FORTUNE.oracleId,
  name: WHEEL_OF_FORTUNE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const pid of ctx.state.seating) {
        if (ctx.state.players[pid]?.hasLost) continue;
        for (const id of ctx.state.zones.hand[pid] ?? []) {
          moves.push({
            card: id,
            from: { kind: 'hand' as const, player: pid },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? pid },
          });
        }
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      for (const pid of ctx.state.seating) {
        if (ctx.state.players[pid]?.hasLost) continue;
        events.push(...drawEvents(ctx.state, pid, 7));
      }
      return events;
    },
  },
};
