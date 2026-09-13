// `Keldon Megaliths` - an activation damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KELDON_MEGALITHS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KELDON_MEGALITHS, "This land enters tapped.\n{T}: Add {R}.\nHellbent — {1}{R}, {T}: This land deals 1 damage to any target. Activate only if you have no cards in hand.");
const LINES = PRINTED.split('\n');

export const KELDON_MEGALITHS_SCRIPT: CardScript = {
  oracleId: KELDON_MEGALITHS.oracleId,
  name: KELDON_MEGALITHS.name,
  activated: [
    {
      ref: `${KELDON_MEGALITHS.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 1,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount ?? 0,
                applyAs: target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
