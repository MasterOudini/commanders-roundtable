// `Calming Verse` — "Destroy all enchantments you don't control. Then if
// you control an untapped land, destroy all enchantments you control."
// Two waves, the second gated on a board query at resolution; each wave
// skips indestructible (CR 701.7b). D202.

import { CALMING_VERSE } from '../../../data/fixtures/engineCards';
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
  CALMING_VERSE,
  "Destroy all enchantments you don't control. Then if you control an untapped land, destroy all enchantments you control.",
);

export const CALMING_VERSE_SCRIPT: CardScript = {
  oracleId: CALMING_VERSE.oracleId,
  name: CALMING_VERSE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let untappedLand = false;
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (
          card.controller === obj.controller &&
          !card.tapped &&
          d.typeLine.types.includes('Land')
        ) {
          untappedLand = true;
        }
        if (!d.typeLine.types.includes('Enchantment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          mine: card.controller === obj.controller,
          move: {
            card: id,
            from: { kind: 'battlefield' as const, player: card.controller },
            to: { kind: 'graveyard' as const, player: card.owner },
          },
        });
      }
      const events: EventBody[] = [];
      const theirs = moves.filter((m) => !m.mine).map((m) => m.move);
      if (theirs.length > 0) events.push({ t: 'CardsMoved', moves: theirs });
      if (untappedLand) {
        const mine = moves.filter((m) => m.mine).map((m) => m.move);
        if (mine.length > 0) events.push({ t: 'CardsMoved', moves: mine });
      }
      return events;
    },
  },
};
