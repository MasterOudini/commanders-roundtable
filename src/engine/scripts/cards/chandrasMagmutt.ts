// `Chandra's Magmutt` — "{T}: This creature deals 1 damage to target player
// or planeswalker." Aladdin's Ring's damage shape behind a plain tap. M6.4j,
// D167.

import { CHANDRA_S_MAGMUTT } from '../../../data/fixtures/engineCards';
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
  CHANDRA_S_MAGMUTT,
  '{T}: This creature deals 1 damage to target player or planeswalker.',
);

export const CHANDRAS_MAGMUTT_SCRIPT: CardScript = {
  oracleId: CHANDRA_S_MAGMUTT.oracleId,
  name: CHANDRA_S_MAGMUTT.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${CHANDRA_S_MAGMUTT.oracleId}#a0`,
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
                amount: 1,
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
