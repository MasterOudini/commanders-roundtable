// `Volcanic Geyser` — X damage at any target. X=0 must deal NOTHING rather
// than a zero-amount entry: a 0 damage event is not the same as no event
// (lifelink and damage triggers both read it). D267.

import { VOLCANIC_GEYSER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VOLCANIC_GEYSER, 'Volcanic Geyser deals X damage to any target.');

export const VOLCANIC_GEYSER_SCRIPT: CardScript = {
  oracleId: VOLCANIC_GEYSER.oracleId,
  name: VOLCANIC_GEYSER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const amount = obj.xValue ?? 0;
      if (amount <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
        return [];
      }
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
              amount,
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
