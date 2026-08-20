// `Morningtide` — "Exile all graveyards." Every card in every graveyard
// leaves in one simultaneous move, each to its owner's exile. D226.

import { MORNINGTIDE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MORNINGTIDE, 'Exile all graveyards.');

export const MORNINGTIDE_SCRIPT: CardScript = {
  oracleId: MORNINGTIDE.oracleId,
  name: MORNINGTIDE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const seat of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const card = ctx.state.cards[id];
          if (!card) continue;
          moves.push({
            card: id,
            from: { kind: 'graveyard' as const, player: seat },
            to: { kind: 'exile' as const, player: card.owner },
          });
        }
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
