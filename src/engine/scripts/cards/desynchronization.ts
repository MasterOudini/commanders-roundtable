// `Desynchronization` — "Return each nonland permanent that's not historic
// to its owner's hand." Historic is CR 700.10 — legendary, artifact, or
// Saga — asked of the DERIVED type line, so a temporarily-legendary
// permanent stays put. One CardsMoved, each card to its OWNER's hand. D208.

import { DESYNCHRONIZATION } from '../../../data/fixtures/engineCards';
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
  DESYNCHRONIZATION,
  "Return each nonland permanent that's not historic to its owner's hand. (Artifacts, legendaries, and Sagas are historic.)",
);

export const DESYNCHRONIZATION_SCRIPT: CardScript = {
  oracleId: DESYNCHRONIZATION.oracleId,
  name: DESYNCHRONIZATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        const tl = d.typeLine;
        if (tl.types.includes('Land')) continue;
        const historic =
          tl.supertypes.includes('Legendary') ||
          tl.types.includes('Artifact') ||
          tl.subtypes.includes('Saga');
        if (historic) continue;
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
