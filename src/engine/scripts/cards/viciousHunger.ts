// `Vicious Hunger` — 2 damage and a flat 2 gain. The gain is NOT
// conditioned on the damage landing: an illegal target fizzles the whole
// spell through the engine's re-check, but a surviving one still pays. One
// shape across four oracle ids (Vampiric Feast and Vampiric Touch, D265), so
// the two new members are generated from one base. D266.

import { VICIOUS_HUNGER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VICIOUS_HUNGER, 'Vicious Hunger deals 2 damage to target creature and you gain 2 life.');

export const VICIOUS_HUNGER_SCRIPT: CardScript = {
  oracleId: VICIOUS_HUNGER.oracleId,
  name: VICIOUS_HUNGER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
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
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: 2,
          to: me.life + 2,
        });
      }
      return events;
    },
  },
};
