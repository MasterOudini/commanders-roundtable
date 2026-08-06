// `Deadeye Duelist` — "Reach\n{1}, {T}: This creature deals 1 damage to
// target opponent." A player-only ping behind a keyword line. M6.4m, D170.

import { DEADEYE_DUELIST } from '../../../data/fixtures/engineCards';
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
  DEADEYE_DUELIST,
  'Reach\n{1}, {T}: This creature deals 1 damage to target opponent.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DEADEYE_DUELIST_SCRIPT: CardScript = {
  oracleId: DEADEYE_DUELIST.oracleId,
  name: DEADEYE_DUELIST.name,
  activated: [
    {
      ref: `${DEADEYE_DUELIST.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'player', id: target.id },
                amount: 1,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: infect ? 'poison' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
