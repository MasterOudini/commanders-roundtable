// `Douse in Gloom` — "Douse in Gloom deals 2 damage to target creature and
// you gain 2 life." Defibrillating Current one noun narrower. D209.

import { DOUSE_IN_GLOOM } from '../../../data/fixtures/engineCards';
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
  DOUSE_IN_GLOOM,
  'Douse in Gloom deals 2 damage to target creature and you gain 2 life.',
);

export const DOUSE_IN_GLOOM_SCRIPT: CardScript = {
  oracleId: DOUSE_IN_GLOOM.oracleId,
  name: DOUSE_IN_GLOOM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const me = ctx.state.players[obj.controller];
      const events: EventBody[] = [
        {
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
        },
      ];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
      }
      return events;
    },
  },
};
