// `Last Kiss` — 2 at the creature, 2 back to me. D222.

import { LAST_KISS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LAST_KISS, 'Last Kiss deals 2 damage to target creature and you gain 2 life.');

export const LAST_KISS_SCRIPT: CardScript = {
  oracleId: LAST_KISS.oracleId,
  name: LAST_KISS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      const events: EventBody[] = [];
      if (target && target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind === 'battlefield') {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 2,
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
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
      }
      return events;
    },
  },
};
