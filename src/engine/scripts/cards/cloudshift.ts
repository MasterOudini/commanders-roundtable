// `Cloudshift` — "Exile target creature you control, then return that card
// to the battlefield under your control." The first FLICKER: two moves in
// one resolve, and the RETURN runs the whole entry funnel (counters,
// enters-tapped, the works) on a card that briefly left. D204.

import { CLOUDSHIFT } from '../../../data/fixtures/engineCards';
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
  CLOUDSHIFT,
  'Exile target creature you control, then return that card to the battlefield under your control.',
);

export const CLOUDSHIFT_SCRIPT: CardScript = {
  oracleId: CLOUDSHIFT.oracleId,
  name: CLOUDSHIFT.name,
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
              to: { kind: 'battlefield', player: obj.controller },
            },
          ],
        },
      ];
    },
  },
};
