// `Chain Reaction` — "Chain Reaction deals X damage to each creature,
// where X is the number of creatures on the battlefield." The count IS the
// batch. D202.

import { CHAIN_REACTION } from '../../../data/fixtures/engineCards';
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
  CHAIN_REACTION,
  'Chain Reaction deals X damage to each creature, where X is the number of creatures on the battlefield.',
);

export const CHAIN_REACTION_SCRIPT: CardScript = {
  oracleId: CHAIN_REACTION.oracleId,
  name: CHAIN_REACTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const creatures = [];
      for (const id of ctx.state.zones.battlefield) {
        if (ctx.derive(id).typeLine.types.includes('Creature')) creatures.push(id);
      }
      const x = creatures.length;
      if (x === 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: creatures.map((id) => ({
            source: self,
            target: { kind: 'card' as const, id },
            amount: x,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          })),
        },
      ];
    },
  },
};
