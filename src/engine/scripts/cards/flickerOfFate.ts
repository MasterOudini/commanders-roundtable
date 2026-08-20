// `Flicker of Fate` — "Exile target creature or enchantment, then return
// it to the battlefield under its owner's control." Cloudshift's flicker
// on the compound, the entry funnel running on the return. D214.

import { FLICKER_OF_FATE } from '../../../data/fixtures/engineCards';
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
  FLICKER_OF_FATE,
  "Exile target creature or enchantment, then return it to the battlefield under its owner's control.",
);

export const FLICKER_OF_FATE_SCRIPT: CardScript = {
  oracleId: FLICKER_OF_FATE.oracleId,
  name: FLICKER_OF_FATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'exile', player: card.owner },
              to: { kind: 'battlefield', player: card.owner },
            },
          ],
        },
      ];
    },
  },
};
