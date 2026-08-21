// `Soulscour` — "Destroy all nonartifact permanents." The negated-type wipe
// over EVERYTHING: lands included, artifacts exempt, indestructible skipped,
// one simultaneous move. D250.

import { SOULSCOUR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOULSCOUR, 'Destroy all nonartifact permanents.');

export const SOULSCOUR_SCRIPT: CardScript = {
  oracleId: SOULSCOUR.oracleId,
  name: SOULSCOUR.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves: CardMove[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (d.typeLine.types.includes('Artifact')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'graveyard', player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
