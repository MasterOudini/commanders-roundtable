// `Smother` — "Destroy target creature with mana value 3 or less. It can't
// be regenerated." The D139 numeric floor enforced at the aim; the
// regeneration sentence is vacuous while the engine has none, and this
// file joins the damnation tripwire's client list. D249.

import { SMOTHER } from '../../../data/fixtures/engineCards';
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
  SMOTHER,
  "Destroy target creature with mana value 3 or less. It can't be regenerated.",
);

export const SMOTHER_SCRIPT: CardScript = {
  oracleId: SMOTHER.oracleId,
  name: SMOTHER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
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
};
