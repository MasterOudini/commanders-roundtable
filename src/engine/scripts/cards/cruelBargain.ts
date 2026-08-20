// `Cruel Bargain` — "Draw four cards. You lose half your life, rounded
// up." The half is computed at resolution. D205.

import { CRUEL_BARGAIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CRUEL_BARGAIN, 'Draw four cards. You lose half your life, rounded up.');

export const CRUEL_BARGAIN_SCRIPT: CardScript = {
  oracleId: CRUEL_BARGAIN.oracleId,
  name: CRUEL_BARGAIN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 4)];
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      const loss = Math.ceil(Math.max(0, life) / 2);
      if (loss > 0) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -loss, to: life - loss });
      }
      return events;
    },
  },
};
