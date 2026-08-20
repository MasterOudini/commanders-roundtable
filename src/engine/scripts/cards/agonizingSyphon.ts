// `Agonizing Syphon` — "Agonizing Syphon deals 3 damage to any target and
// you gain 3 life." Char's one-dealing shape with a gain instead of a
// recoil. D197.

import { AGONIZING_SYPHON } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AGONIZING_SYPHON, 'Agonizing Syphon deals 3 damage to any target and you gain 3 life.');

export const AGONIZING_SYPHON_SCRIPT: CardScript = {
  oracleId: AGONIZING_SYPHON.oracleId,
  name: AGONIZING_SYPHON.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const caster = ctx.state.players[obj.controller];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
              amount: 3,
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
      if (caster && !caster.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 3, to: caster.life + 3 });
      }
      return events;
    },
  },
};
