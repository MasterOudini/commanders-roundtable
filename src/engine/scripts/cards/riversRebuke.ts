// `River's Rebuke` — "Return all nonland permanents target player
// controls to their owner's hand." The one-player nonland board bounce:
// Aetherize's owner-hand sweep behind a player target. D241.

import { RIVER_S_REBUKE } from '../../../data/fixtures/engineCards';
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
  RIVER_S_REBUKE,
  "Return all nonland permanents target player controls to their owner's hand.",
);

export const RIVERS_REBUKE_SCRIPT: CardScript = {
  oracleId: RIVER_S_REBUKE.oracleId,
  name: RIVER_S_REBUKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) continue;
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
