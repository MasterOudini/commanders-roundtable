// `Planar Birth` — "Return all basic land cards from all graveyards to
// the battlefield tapped under their owners' control." The mass tapped
// reanimation: one move for every basic, typed off the oracle face, then
// one batch tap (Nurgle's Conscription's idiom at format width). A card
// entering the battlefield answers to its owner by default (CR 108.4),
// which is exactly what the card asks for. D233.

import { PLANAR_BIRTH } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  PLANAR_BIRTH,
  "Return all basic land cards from all graveyards to the battlefield tapped under their owners' control.",
);

export const PLANAR_BIRTH_SCRIPT: CardScript = {
  oracleId: PLANAR_BIRTH.oracleId,
  name: PLANAR_BIRTH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      const risen: InstanceId[] = [];
      for (const seat of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
          if (!card || !oc) continue;
          const face = faceOf(oc, card.faceIndex ?? 0);
          if (!face.typeLine.types.includes('Land')) continue;
          if (!face.typeLine.supertypes.includes('Basic')) continue;
          moves.push({
            card: id,
            from: { kind: 'graveyard' as const, player: seat },
            to: { kind: 'battlefield' as const, player: card.owner },
          });
          risen.push(id);
        }
      }
      if (moves.length === 0) return [];
      return [
        { t: 'CardsMoved', moves },
        { t: 'PermanentsTapped', cards: risen },
      ];
    },
  },
};
