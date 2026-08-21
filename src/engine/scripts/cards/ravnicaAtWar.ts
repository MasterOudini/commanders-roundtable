// `Ravnica at War` — "Exile all multicolored permanents." The
// multicolored filter is DERIVED colors at length two or more; exile is
// not destruction, so indestructible does not help. D237.

import { RAVNICA_AT_WAR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RAVNICA_AT_WAR, 'Exile all multicolored permanents.');

export const RAVNICA_AT_WAR_SCRIPT: CardScript = {
  oracleId: RAVNICA_AT_WAR.oracleId,
  name: RAVNICA_AT_WAR.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (ctx.derive(id).colors.length < 2) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      return moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
    },
  },
};
