// `Wrath of God` — "Destroy all creatures. They can't be regenerated."
// Damnation's exact shape on the original card: every DERIVED creature in
// ONE CardsMoved (simultaneous), indestructible survives (CR 701.7b), and
// the regeneration clause is vacuous under `damnation.node.test.ts`'s
// source-scan tripwire. D196.

import { WRATH_OF_GOD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WRATH_OF_GOD, "Destroy all creatures. They can't be regenerated.");

export const WRATH_OF_GOD_SCRIPT: CardScript = {
  oracleId: WRATH_OF_GOD.oracleId,
  name: WRATH_OF_GOD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
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
