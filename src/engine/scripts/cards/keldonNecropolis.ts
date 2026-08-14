// `Keldon Necropolis` — "{4}{R}, {T}, Sacrifice a creature: Keldon
// Necropolis deals 2 damage to any target." Heartwood Giant's chooser+damage
// on a legendary LAND, at `#a1` behind the mana line. M6.4ab, D184.

import { KELDON_NECROPOLIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  KELDON_NECROPOLIS,
  '{T}: Add {C}.\n{4}{R}, {T}, Sacrifice a creature: Keldon Necropolis deals 2 damage to any target.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const KELDON_NECROPOLIS_SCRIPT: CardScript = {
  oracleId: KELDON_NECROPOLIS.oracleId,
  name: KELDON_NECROPOLIS.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the ping as ability 1.
      ref: `${KELDON_NECROPOLIS.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
          return [];
        const d = ctx.derive(self);
        return [
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
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect')
                  ? target.kind === 'player'
                    ? 'poison'
                    : 'wither'
                  : d.keywords.has('wither') && target.kind === 'card'
                    ? 'wither'
                    : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
