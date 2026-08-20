// `Flame Burst` — "Flame Burst deals X damage to any target, where X is 2
// plus the number of cards named Flame Burst in all graveyards." Feast of
// Flesh's census at any target. D213.

import { FLAME_BURST } from '../../../data/fixtures/engineCards';
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
  FLAME_BURST,
  'Flame Burst deals X damage to any target, where X is 2 plus the number of cards named Flame Burst in all graveyards.',
);

export const FLAME_BURST_SCRIPT: CardScript = {
  oracleId: FLAME_BURST.oracleId,
  name: FLAME_BURST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
      let named = 0;
      for (const pid of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[pid] ?? []) {
          const card = ctx.state.cards[id];
          if (!card) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name === 'Flame Burst') named++;
        }
      }
      const x = 2 + named;
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
              amount: x,
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
