// `Beyond the Quiet` — "Exile all creatures and Spacecraft." A type-OR-
// subtype wipe in one simultaneous CardsMoved; exile is not destruction, so
// indestructible goes too (Apocalypse's rule). D199.

import { BEYOND_THE_QUIET } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BEYOND_THE_QUIET, 'Exile all creatures and Spacecraft.');

export const BEYOND_THE_QUIET_SCRIPT: CardScript = {
  oracleId: BEYOND_THE_QUIET.oracleId,
  name: BEYOND_THE_QUIET.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature') && !d.typeLine.subtypes.includes('Spacecraft'))
          continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
