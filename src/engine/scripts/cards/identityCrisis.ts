// `Identity Crisis` — the target player's hand AND graveyard go to
// exile, choicelessly. D219.

import { IDENTITY_CRISIS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(IDENTITY_CRISIS, "Exile all cards from target player's hand and graveyard.");

export const IDENTITY_CRISIS_SCRIPT: CardScript = {
  oracleId: IDENTITY_CRISIS.oracleId,
  name: IDENTITY_CRISIS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      if (ctx.state.players[target.id]?.hasLost) return [];
      const moves = [];
      for (const id of ctx.state.zones.hand[target.id] ?? []) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        moves.push({
          card: id,
          from: { kind: 'hand' as const, player: target.id },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      for (const id of ctx.state.zones.graveyard[target.id] ?? []) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        moves.push({
          card: id,
          from: { kind: 'graveyard' as const, player: target.id },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
