// `Engulf the Shore` — "Return to their owners' hands all creatures with
// toughness less than or equal to the number of Islands you control." The
// bound is my Island count, the toughness is DERIVED, and every board is
// swept. D210.

import { ENGULF_THE_SHORE } from '../../../data/fixtures/engineCards';
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
  ENGULF_THE_SHORE,
  "Return to their owners' hands all creatures with toughness less than or equal to the number of Islands you control.",
);

export const ENGULF_THE_SHORE_SCRIPT: CardScript = {
  oracleId: ENGULF_THE_SHORE.oracleId,
  name: ENGULF_THE_SHORE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let islands = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Island')) islands++;
      }
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if ((d.toughness ?? 0) > islands) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
