// `Retribution of the Meek` — "Destroy all creatures with power 4 or
// greater. They can't be regenerated." Fell the Mighty's derived-power
// sweep at a printed flat bar; the regeneration clause is vacuous while
// the engine has no regeneration and this file is a client of the
// damnation tripwire (D192) — the SIXTEENTH. D240.

import { RETRIBUTION_OF_THE_MEEK } from '../../../data/fixtures/engineCards';
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
  RETRIBUTION_OF_THE_MEEK,
  "Destroy all creatures with power 4 or greater. They can't be regenerated.",
);

export const RETRIBUTION_OF_THE_MEEK_SCRIPT: CardScript = {
  oracleId: RETRIBUTION_OF_THE_MEEK.oracleId,
  name: RETRIBUTION_OF_THE_MEEK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if ((d.power ?? 0) < 4) continue;
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
