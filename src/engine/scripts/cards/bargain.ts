// `Bargain` — "Target opponent draws a card.\nYou gain 7 life." The draw goes
// to the TARGET (an opponent — the aim layer enforces it), the life to me.
// A departed target has already fizzled the spell (CR 608.2b), so the gain
// never lands without the draw. D272.

import { BARGAIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BARGAIN, 'Target opponent draws a card.\nYou gain 7 life.');

export const BARGAIN_SCRIPT: CardScript = {
  oracleId: BARGAIN.oracleId,
  name: BARGAIN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const them = ctx.state.players[target.id];
      if (!them || them.hasLost) return [];
      const events: EventBody[] = [...drawEvents(ctx.state, target.id, 1)];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 7, to: me.life + 7 });
      }
      return events;
    },
  },
};
