// `Ruinous Ultimatum` — "Destroy all nonland permanents your opponents
// control." The opponents-only nonland wipe: Kaya's Wrath's controller
// filter inverted, indestructible asked per object. D242.

import { RUINOUS_ULTIMATUM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RUINOUS_ULTIMATUM, 'Destroy all nonland permanents your opponents control.');

export const RUINOUS_ULTIMATUM_SCRIPT: CardScript = {
  oracleId: RUINOUS_ULTIMATUM.oracleId,
  name: RUINOUS_ULTIMATUM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        const d = ctx.derive(id);
        if (d.typeLine.types.includes('Land')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
