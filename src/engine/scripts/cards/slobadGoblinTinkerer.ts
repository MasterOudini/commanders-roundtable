// `Slobad, Goblin Tinkerer` — "Sacrifice an artifact: Target artifact gains
// indestructible until end of turn." The mana-free chooser feeding a
// keyword-only grant on the carrier. D249.

import { SLOBAD_GOBLIN_TINKERER } from '../../../data/fixtures/engineCards';
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
  SLOBAD_GOBLIN_TINKERER,
  'Sacrifice an artifact: Target artifact gains indestructible until end of turn.',
);

export const SLOBAD_GOBLIN_TINKERER_SCRIPT: CardScript = {
  oracleId: SLOBAD_GOBLIN_TINKERER.oracleId,
  name: SLOBAD_GOBLIN_TINKERER.name,
  activated: [
    {
      ref: `${SLOBAD_GOBLIN_TINKERER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['indestructible'],
          },
        ];
      },
    },
  ],
};
