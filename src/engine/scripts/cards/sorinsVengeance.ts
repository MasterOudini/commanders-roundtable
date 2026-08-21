// `Sorin's Vengeance` — "deals 10 damage to target player or planeswalker
// and you gain 10 life." The compound spec at ten. D249.

import { SORIN_S_VENGEANCE } from '../../../data/fixtures/engineCards';
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
  SORIN_S_VENGEANCE,
  "Sorin's Vengeance deals 10 damage to target player or planeswalker and you gain 10 life.",
);

export const SORINS_VENGEANCE_SCRIPT: CardScript = {
  oracleId: SORIN_S_VENGEANCE.oracleId,
  name: SORIN_S_VENGEANCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount: 10,
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
      const player = ctx.state.players[obj.controller];
      if (player && !player.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 10, to: player.life + 10 });
      }
      return events;
    },
  },
};
