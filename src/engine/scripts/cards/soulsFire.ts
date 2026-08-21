// `Soul's Fire` — "Target creature you control deals damage equal to its
// power to any target." The bite pointed anywhere: TWO probed specs, the
// power AND the riders read off the biting creature at resolution. D250.

import { SOUL_S_FIRE } from '../../../data/fixtures/engineCards';
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
  SOUL_S_FIRE,
  'Target creature you control deals damage equal to its power to any target.',
);

export const SOULS_FIRE_SCRIPT: CardScript = {
  oracleId: SOUL_S_FIRE.oracleId,
  name: SOUL_S_FIRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const biter = obj.targets[0];
      const victim = obj.targets[1];
      if (!biter || biter.kind !== 'card') return [];
      if (ctx.state.cards[biter.id]?.zone.kind !== 'battlefield') return [];
      if (!victim) return [];
      if (victim.kind === 'card' && ctx.state.cards[victim.id]?.zone.kind !== 'battlefield')
        return [];
      const d = ctx.derive(biter.id);
      const power = d.power ?? 0;
      if (power <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: biter.id,
              target:
                victim.kind === 'player'
                  ? { kind: 'player', id: victim.id }
                  : { kind: 'card', id: victim.id },
              amount: power,
              deathtouch: d.keywords.has('deathtouch'),
              lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: d.toxicAmount,
              applyAs: d.keywords.has('infect')
                ? victim.kind === 'player'
                  ? 'poison'
                  : 'wither'
                : d.keywords.has('wither') && victim.kind === 'card'
                  ? 'wither'
                  : 'normal',
            },
          ],
        },
      ];
    },
  },
};
