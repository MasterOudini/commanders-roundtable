// `Kiss of Death` — 4 at the opponent or planeswalker, 4 back to me.
// D221.

import { KISS_OF_DEATH } from '../../../data/fixtures/engineCards';
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
  KISS_OF_DEATH,
  'Kiss of Death deals 4 damage to target opponent or planeswalker. You gain 4 life.',
);

export const KISS_OF_DEATH_SCRIPT: CardScript = {
  oracleId: KISS_OF_DEATH.oracleId,
  name: KISS_OF_DEATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      const events: EventBody[] = [];
      if (target && target.kind !== 'stack') {
        const legal =
          target.kind === 'player'
            ? !ctx.state.players[target.id]?.hasLost
            : ctx.state.cards[target.id]?.zone.kind === 'battlefield';
        if (legal) {
          events.push({
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target:
                  target.kind === 'player'
                    ? { kind: 'player', id: target.id }
                    : { kind: 'card', id: target.id },
                amount: 4,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          });
        }
      }
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 });
      }
      return events;
    },
  },
};
