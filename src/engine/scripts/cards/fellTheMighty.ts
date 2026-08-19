// `Fell the Mighty` — "Destroy all creatures with power greater than target
// creature's power." The first TARGET-PARAMETERISED wipe: the threshold is
// the target's DERIVED power read at resolution (a pumped 2/2 raises the
// bar, CR 613 settles characteristics first). Strictly greater, so the
// target itself can never qualify. Indestructible survives; one CardsMoved
// so the deaths are simultaneous. D192.

import { FELL_THE_MIGHTY } from '../../../data/fixtures/engineCards';
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
  FELL_THE_MIGHTY,
  "Destroy all creatures with power greater than target creature's power.",
);

export const FELL_THE_MIGHTY_SCRIPT: CardScript = {
  oracleId: FELL_THE_MIGHTY.oracleId,
  name: FELL_THE_MIGHTY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const bar = ctx.derive(target.id).power ?? 0;
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if ((d.power ?? 0) <= bar) continue;
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
