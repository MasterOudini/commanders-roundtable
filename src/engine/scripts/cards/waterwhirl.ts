// `Waterwhirl` — "Return up to two target creatures to their owners' hands."
//
// ⚠️⚠️ THE UP-TO-N CLASS IN THE **PLURAL**. D266's Vibrant Outburst measured
// "up to ONE" as min 0 / max 1; this probes as **min 0 / max 2**, confident,
// with `unenforced: []`. That is the more valuable half of D262's finding —
// most of the 50-entry up-to-N ledger class is plural — and it means the
// chooser is owed only for the forms that do NOT parse, not for the wording
// as a family.
//
// The resolve walks EVERY target rather than reading [0] and [1], because the
// answer may legally carry nought, one or two. D268.

import { WATERWHIRL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WATERWHIRL, "Return up to two target creatures to their owners' hands.");

export const WATERWHIRL_SCRIPT: CardScript = {
  oracleId: WATERWHIRL.oracleId,
  name: WATERWHIRL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
