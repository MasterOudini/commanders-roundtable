// `Aladdin's Ring` — "{8}, {T}: This artifact deals 4 damage to any target."
// The first script DAMAGE (M6.4c, D160): a `ResolvedDamage` built the way
// `effects.ts`'s `damageTo` builds one — keywords read off the DERIVED source,
// `applyAs` decided by infect/wither and the target's kind — so a Ring that
// somehow gained infect would poison correctly rather than ignore it.

import { ALADDIN_S_RING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ALADDIN_S_RING, '{8}, {T}: This artifact deals 4 damage to any target.');

export const ALADDINS_RING_SCRIPT: CardScript = {
  oracleId: ALADDIN_S_RING.oracleId,
  name: ALADDIN_S_RING.name,
  activated: [
    {
      ref: `${ALADDIN_S_RING.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
          return [];
        }
        if (target.kind === 'stack') return [];
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        const applyAs =
          target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal';
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
                amount: 4,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs,
              },
            ],
          },
        ];
      },
    },
  ],
};
