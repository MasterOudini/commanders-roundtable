// `Whirlwind` — "Destroy all creatures with flying."
//
// ⚠️ Worth reading beside its batch-mates `Wing Snare` and `Wing Puncture`,
// which are REFUSED. The difference is not the keyword — it is WHERE the
// keyword sits. Here "with flying" is a RESOLVE-side predicate I read off the
// derived keywords myself, and it works perfectly. There it is a TARGET noun,
// and the aim layer drops it silently (D261/D262/D265/D269). Same word, two
// fates. D269.

import { WHIRLWIND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WHIRLWIND, 'Destroy all creatures with flying.');

export const WHIRLWIND_SCRIPT: CardScript = {
  oracleId: WHIRLWIND.oracleId,
  name: WHIRLWIND.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.keywords.has('flying')) continue;
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
