// `Damnation` — "Destroy all creatures. They can't be regenerated." The
// first board wipe: every DERIVED creature (an animated land dies too, CR
// 613 settles types before anything reads them), indestructible survives
// (CR 701.7b), all deaths in ONE CardsMoved so they are simultaneous.
//
// ⚠️ "They can't be regenerated" is VACUOUS BY CONSTRUCTION in this engine:
// regeneration does not exist anywhere — no regeneration shield, no effect
// that can create one, nothing in the SBA that would consult one — so
// "destroy without regeneration" and "destroy" are the same act here. The
// whole-card claim is honest because the clause modifies a mechanism the
// engine does not have; the test pins this reasoning. D192.

import { DAMNATION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DAMNATION, "Destroy all creatures. They can't be regenerated.");

export const DAMNATION_SCRIPT: CardScript = {
  oracleId: DAMNATION.oracleId,
  name: DAMNATION.name,
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
