// `Rise of the Dark Realms` — "Put all creature cards from all
// graveyards onto the battlefield under your control." Planar Birth's
// format-wide sweep composed with Reanimate's theft: the battlefield
// move's `to.player` IS the controller, so every corpse answers to the
// caster while its owner stays printed. Typed off the ORACLE face — a
// graveyard card has no battlefield derivation. D240.

import { RISE_OF_THE_DARK_REALMS } from '../../../data/fixtures/engineCards';
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
  RISE_OF_THE_DARK_REALMS,
  'Put all creature cards from all graveyards onto the battlefield under your control.',
);

export const RISE_OF_THE_DARK_REALMS_SCRIPT: CardScript = {
  oracleId: RISE_OF_THE_DARK_REALMS.oracleId,
  name: RISE_OF_THE_DARK_REALMS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const seat of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
          if (!card || !oc) continue;
          const face = faceOf(oc, card.faceIndex ?? 0);
          if (!face.typeLine.types.includes('Creature')) continue;
          moves.push({
            card: id,
            from: { kind: 'graveyard' as const, player: seat },
            to: { kind: 'battlefield' as const, player: obj.controller },
          });
        }
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
