// `Void Helix` — 5 damage and a flat 5 gain. The gain is NOT
// conditioned on the damage landing: an illegal target fizzles the whole
// spell through the engine's re-check, but a surviving one still pays. One
// shape across four oracle ids (Vampiric Feast and Vampiric Touch, D265), so
// the two new members are generated from one base. D266.

import { VOID_HELIX } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VOID_HELIX, 'Void Helix deals 5 damage to any target and you gain 5 life.');

export const VOID_HELIX_SCRIPT: CardScript = {
  oracleId: VOID_HELIX.oracleId,
  name: VOID_HELIX.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
        return [];
      }
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: target.kind === 'player'
                    ? { kind: 'player', id: target.id }
                    : { kind: 'card', id: target.id },
              amount: 5,
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
          delta: 5,
          to: me.life + 5,
        });
      }
      return events;
    },
  },
};
