// `Crypt Incursion` — "Exile all creature cards from target player's
// graveyard. You gain 3 life for each card exiled this way." Oracle-face
// types over the target's graveyard, one move batch, the gain counted
// from what actually moved. D205.

import { CRYPT_INCURSION } from '../../../data/fixtures/engineCards';
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
  CRYPT_INCURSION,
  "Exile all creature cards from target player's graveyard. You gain 3 life for each card exiled this way.",
);

export const CRYPT_INCURSION_SCRIPT: CardScript = {
  oracleId: CRYPT_INCURSION.oracleId,
  name: CRYPT_INCURSION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const moves = [];
      for (const id of ctx.state.zones.graveyard[target.id] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
        if (!oc) continue;
        if (!faceOf(oc, card?.faceIndex ?? 0).typeLine.types.includes('Creature')) continue;
        moves.push({
          card: id,
          from: { kind: 'graveyard' as const, player: target.id },
          to: { kind: 'exile' as const, player: card?.owner ?? target.id },
        });
      }
      if (moves.length === 0) return [];
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      const gain = 3 * moves.length;
      return [
        { t: 'CardsMoved', moves },
        { t: 'LifeChanged', player: obj.controller, delta: gain, to: life + gain },
      ];
    },
  },
};
