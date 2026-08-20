// `Empty the Catacombs` — "Each player returns all creature cards from
// their graveyard to their hand." Choiceless, typed off the ORACLE face
// (a graveyard card has no battlefield derivation), one CardsMoved. D210.

import { EMPTY_THE_CATACOMBS } from '../../../data/fixtures/engineCards';
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
  EMPTY_THE_CATACOMBS,
  'Each player returns all creature cards from their graveyard to their hand.',
);

export const EMPTY_THE_CATACOMBS_SCRIPT: CardScript = {
  oracleId: EMPTY_THE_CATACOMBS.oracleId,
  name: EMPTY_THE_CATACOMBS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const pid of ctx.state.seating) {
        if (ctx.state.players[pid]?.hasLost) continue;
        for (const id of ctx.state.zones.graveyard[pid] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card && ctx.oracle.byPrinting(card.printingId);
          if (!oc) continue;
          if (!faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Creature')) continue;
          moves.push({
            card: id,
            from: { kind: 'graveyard' as const, player: pid },
            to: { kind: 'hand' as const, player: card.owner },
          });
        }
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
