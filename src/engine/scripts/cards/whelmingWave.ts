// `Whelming Wave` — return ALL creatures EXCEPT four subtypes. A negated
// SUBTYPE LIST, but read RESOLVE-side off derived subtypes, so it needs none
// of the aim-layer field the subtype noun list is still owed. My own
// non-sea-monsters go home with theirs. D269.

import { WHELMING_WAVE } from '../../../data/fixtures/engineCards';
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
  WHELMING_WAVE,
  "Return all creatures to their owners' hands except for Krakens, Leviathans, Octopuses, and Serpents.",
);

/** The card names its own exceptions; the singulars are the subtypes. */
const SPARED = ['Kraken', 'Leviathan', 'Octopus', 'Serpent'];

export const WHELMING_WAVE_SCRIPT: CardScript = {
  oracleId: WHELMING_WAVE.oracleId,
  name: WHELMING_WAVE.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (SPARED.some((s) => d.typeLine.subtypes.includes(s))) continue;
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
