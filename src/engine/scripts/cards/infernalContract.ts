// `Infernal Contract` — Cruel Bargain's exact printed text on its own
// oracle id: draw four, lose half rounded up. D219.

import { INFERNAL_CONTRACT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(INFERNAL_CONTRACT, 'Draw four cards. You lose half your life, rounded up.');

export const INFERNAL_CONTRACT_SCRIPT: CardScript = {
  oracleId: INFERNAL_CONTRACT.oracleId,
  name: INFERNAL_CONTRACT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 4)];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        const loss = Math.ceil(me.life / 2);
        if (loss > 0) {
          events.push({ t: 'LifeChanged', player: obj.controller, delta: -loss, to: me.life - loss });
        }
      }
      return events;
    },
  },
};
