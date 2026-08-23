// `Vampiric Touch` — 2 to an opponent-or-planeswalker and a flat 2 gain. The
// compound PROBED with both kinds carried AND the opponent restriction
// enforced, so the aim refuses the caster's own face. D265.

import { VAMPIRIC_TOUCH } from '../../../data/fixtures/engineCards';
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
  VAMPIRIC_TOUCH,
  'Vampiric Touch deals 2 damage to target opponent or planeswalker and you gain 2 life.',
);

export const VAMPIRIC_TOUCH_SCRIPT: CardScript = {
  oracleId: VAMPIRIC_TOUCH.oracleId,
  name: VAMPIRIC_TOUCH.name,
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
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
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
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
      }
      return events;
    },
  },
};
