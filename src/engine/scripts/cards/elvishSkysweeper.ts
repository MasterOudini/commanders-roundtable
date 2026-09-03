// `Elvish Skysweeper` — {4}{G}, Sacrifice a creature: destroy a flyer. The
// sacrifice is D168's chooser; the flying restriction is D289's.

import { ELVISH_SKYSWEEPER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ELVISH_SKYSWEEPER, '{4}{G}, Sacrifice a creature: Destroy target creature with flying.');

export const ELVISH_SKYSWEEPER_SCRIPT: CardScript = {
  oracleId: ELVISH_SKYSWEEPER.oracleId,
  name: ELVISH_SKYSWEEPER.name,
  activated: [
    {
      ref: `${ELVISH_SKYSWEEPER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
