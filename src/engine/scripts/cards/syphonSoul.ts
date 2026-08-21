// `Syphon Soul` — 2 to each OTHER player, and the gain is the TOTAL dealt
// (2 × the number of opponents actually hit), not a flat 2. D256.

import { SYPHON_SOUL } from '../../../data/fixtures/engineCards';
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
  SYPHON_SOUL,
  'Syphon Soul deals 2 damage to each other player. You gain life equal to the damage dealt this way.',
);

export const SYPHON_SOUL_SCRIPT: CardScript = {
  oracleId: SYPHON_SOUL.oracleId,
  name: SYPHON_SOUL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
          amount: 2,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      const events: EventBody[] = [{ t: 'DamageDealt', damages }];
      const gain = damages.length * 2;
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: gain, to: me.life + gain });
      }
      return events;
    },
  },
};
