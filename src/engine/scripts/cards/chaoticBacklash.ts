// `Chaotic Backlash` — "Chaotic Backlash deals damage to target player
// equal to twice the number of white and/or blue permanents they control."
// The count is DERIVED colors: white OR blue counts once per permanent.
// D203.

import { CHAOTIC_BACKLASH } from '../../../data/fixtures/engineCards';
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
  CHAOTIC_BACKLASH,
  'Chaotic Backlash deals damage to target player equal to twice the number of white and/or blue permanents they control.',
);

export const CHAOTIC_BACKLASH_SCRIPT: CardScript = {
  oracleId: CHAOTIC_BACKLASH.oracleId,
  name: CHAOTIC_BACKLASH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        const colors = ctx.derive(id).colors;
        if (colors.includes('W') || colors.includes('U')) n++;
      }
      if (n === 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: target.id },
              amount: 2 * n,
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
