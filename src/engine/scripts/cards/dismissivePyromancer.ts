// `Dismissive Pyromancer` - an activation draw, an activation damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DISMISSIVE_PYROMANCER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(DISMISSIVE_PYROMANCER, "{R}, {T}, Discard a card: Draw a card.\n{2}{R}, {T}, Sacrifice this creature: It deals 4 damage to target creature.");
const LINES = PRINTED.split('\n');

export const DISMISSIVE_PYROMANCER_SCRIPT: CardScript = {
  oracleId: DISMISSIVE_PYROMANCER.oracleId,
  name: DISMISSIVE_PYROMANCER.name,
  activated: [
    {
      ref: `${DISMISSIVE_PYROMANCER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      ref: `${DISMISSIVE_PYROMANCER.oracleId}#a1`,
      text: LINES[1] as string,
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
                amount: 4,
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
