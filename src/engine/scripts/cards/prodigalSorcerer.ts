// `Prodigal Sorcerer` — Prodigal Pyromancer's exact printed text on the
// original id: "{T}: This creature deals 1 damage to any target." D235.

import { PRODIGAL_SORCERER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PRODIGAL_SORCERER, '{T}: This creature deals 1 damage to any target.');

export const PRODIGAL_SORCERER_SCRIPT: CardScript = {
  oracleId: PRODIGAL_SORCERER.oracleId,
  name: PRODIGAL_SORCERER.name,
  activated: [
    {
      ref: `${PRODIGAL_SORCERER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
          return [];
        }
        if (target.kind === 'player' && !ctx.state.players[target.id]) return [];
        if (target.kind !== 'card' && target.kind !== 'player') return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'card' ? { kind: 'card', id: target.id } : { kind: 'player', id: target.id },
                amount: 1,
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
      },
    },
  ],
};
