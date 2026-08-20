// `Legion's End` — the small creature, its battlefield namesakes, and
// every namesake card in that player's hand and graveyard, all exiled
// with the hand revealed: Declaration in Stone + Echoing Decay + Hour
// of Glory in one resolve. D222.

import { LEGION_S_END } from '../../../data/fixtures/engineCards';
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
  LEGION_S_END,
  'Exile target creature an opponent controls with mana value 2 or less and all other creatures that player controls with the same name as that creature. Then that player reveals their hand and exiles all cards with that name from their hand and graveyard.',
);

export const LEGIONS_END_SCRIPT: CardScript = {
  oracleId: LEGION_S_END.oracleId,
  name: LEGION_S_END.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const controller = victim.controller;
      const name = ctx.oracle.byPrinting(victim.printingId)?.name;
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== controller) continue;
        const isTarget = id === target.id;
        if (!isTarget) {
          if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name !== name) continue;
        }
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      const hand = ctx.state.zones.hand[controller] ?? [];
      if (hand.length > 0) events.push({ t: 'CardsRevealed', cards: hand, to: ctx.state.seating });
      for (const id of hand) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (ctx.oracle.byPrinting(card.printingId)?.name !== name) continue;
        moves.push({
          card: id,
          from: { kind: 'hand' as const, player: controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      for (const id of ctx.state.zones.graveyard[controller] ?? []) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (ctx.oracle.byPrinting(card.printingId)?.name !== name) continue;
        moves.push({
          card: id,
          from: { kind: 'graveyard' as const, player: controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
