// `Malevolent Awakening` — "{1}{B}{B}, Sacrifice a creature: Return target
// creature card from your graveyard to your hand." The creature chooser
// paying for D138's graveyard return, on an enchantment. M6.4ac, D185.

import { MALEVOLENT_AWAKENING } from '../../../data/fixtures/engineCards';
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
  MALEVOLENT_AWAKENING,
  '{1}{B}{B}, Sacrifice a creature: Return target creature card from your graveyard to your hand.',
);

export const MALEVOLENT_AWAKENING_SCRIPT: CardScript = {
  oracleId: MALEVOLENT_AWAKENING.oracleId,
  name: MALEVOLENT_AWAKENING.name,
  activated: [
    {
      ref: `${MALEVOLENT_AWAKENING.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'graveyard', player: card.owner },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
