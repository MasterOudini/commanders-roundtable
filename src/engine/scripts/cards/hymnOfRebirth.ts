// `Hymn of Rebirth` — the reanimation gift: a creature card from ANY
// graveyard onto MY battlefield, the entry funnel running on it. D218.

import { HYMN_OF_REBIRTH } from '../../../data/fixtures/engineCards';
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
  HYMN_OF_REBIRTH,
  'Put target creature card from a graveyard onto the battlefield under your control.',
);

export const HYMN_OF_REBIRTH_SCRIPT: CardScript = {
  oracleId: HYMN_OF_REBIRTH.oracleId,
  name: HYMN_OF_REBIRTH.name,
  spell: {
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
              to: { kind: 'battlefield', player: obj.controller },
            },
          ],
        },
      ];
    },
  },
};
