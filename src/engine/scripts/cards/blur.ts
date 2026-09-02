// `Blur` — "Exile target creature you control, then return that card to the
// battlefield under its owner's control.\nDraw a card." Acrobatic Maneuver's
// EXACT text one batch later (D272) — the same flicker under the OWNER and
// the same draw, the way TCRI Building repeated Swiftwater Cliffs (D257).
// D273.

import { BLUR } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  BLUR,
  "Exile target creature you control, then return that card to the battlefield under its owner's control.\nDraw a card.",
);

export const BLUR_SCRIPT: CardScript = {
  oracleId: BLUR.oracleId,
  name: BLUR.name,
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
        ...drawEvents(ctx.state, obj.controller, 1),
      ];
    },
  },
};
