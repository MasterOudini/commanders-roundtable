// `Leeches` — the poison comes off and comes back as damage. D222.

import { LEECHES } from '../../../data/fixtures/engineCards';
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
  LEECHES,
  'Target player loses all poison counters. Leeches deals that much damage to that player.',
);

export const LEECHES_SCRIPT: CardScript = {
  oracleId: LEECHES.oracleId,
  name: LEECHES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      const n = p.poison;
      if (n <= 0) return [];
      return [
        { t: 'PoisonChanged', player: target.id, delta: -n, to: 0 },
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: target.id },
              amount: n,
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
};
