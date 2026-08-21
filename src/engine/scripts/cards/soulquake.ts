// `Soulquake` — "Return all creatures on the battlefield and all creature
// cards in graveyards to their owners' hands." The two-zone mass bounce in
// ONE simultaneous move: battlefield creatures DERIVED, graveyard cards
// typed off the ORACLE face. D250.

import { SOULQUAKE } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardMove, EventBody } from '../../types/events';
import type { CardScript } from '../api';

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
  SOULQUAKE,
  "Return all creatures on the battlefield and all creature cards in graveyards to their owners' hands.",
);

export const SOULQUAKE_SCRIPT: CardScript = {
  oracleId: SOULQUAKE.oracleId,
  name: SOULQUAKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves: CardMove[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'hand', player: card.owner },
        });
      }
      for (const seat of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const inst = ctx.state.cards[id];
          if (!inst) continue;
          const oc = ctx.oracle.byPrinting(inst.printingId);
          if (!oc) continue;
          if (!faceOf(oc, inst.faceIndex).typeLine.types.includes('Creature')) continue;
          moves.push({
            card: id,
            from: { kind: 'graveyard', player: seat },
            to: { kind: 'hand', player: inst.owner },
          });
        }
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
