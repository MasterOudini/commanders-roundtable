// `Fallen Ferromancer` — "Infect\n{1}{R}, {T}: This creature deals 1 damage
// to any target." The activated ping built the way `damageTo` builds it —
// and the DERIVED keywords carry the Ferromancer's own infect into the
// damage, which is the whole reason the card exists. M6.4r, D174.

import { FALLEN_FERROMANCER } from '../../../data/fixtures/engineCards';
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
  FALLEN_FERROMANCER,
  'Infect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)\n' +
    '{1}{R}, {T}: This creature deals 1 damage to any target.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const FALLEN_FERROMANCER_SCRIPT: CardScript = {
  oracleId: FALLEN_FERROMANCER.oracleId,
  name: FALLEN_FERROMANCER.name,
  activated: [
    {
      ref: `${FALLEN_FERROMANCER.oracleId}#a0`,
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
                amount: 1,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                // combat.ts's own rule: infect is POISON to a player, a
                // -1/-1 counter to a creature (CR 702.90b/c).
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
