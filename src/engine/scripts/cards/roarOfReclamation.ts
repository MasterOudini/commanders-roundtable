// `Roar of Reclamation` — "Each player returns all artifact cards from
// their graveyard to the battlefield." Planar Birth's per-owner sweep
// for artifacts, untapped; typed off the ORACLE face. D241.

import { ROAR_OF_RECLAMATION } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  ROAR_OF_RECLAMATION,
  'Each player returns all artifact cards from their graveyard to the battlefield.',
);

export const ROAR_OF_RECLAMATION_SCRIPT: CardScript = {
  oracleId: ROAR_OF_RECLAMATION.oracleId,
  name: ROAR_OF_RECLAMATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const seat of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
          if (!card || !oc) continue;
          const face = faceOf(oc, card.faceIndex ?? 0);
          if (!face.typeLine.types.includes('Artifact')) continue;
          moves.push({
            card: id,
            from: { kind: 'graveyard' as const, player: seat },
            to: { kind: 'battlefield' as const, player: seat },
          });
        }
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
