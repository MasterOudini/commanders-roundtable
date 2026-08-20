// `Hour of Glory` — exile the target; if it WAS a God (derived, read
// pre-move), its controller's hand goes public and every same-name card
// in it is exiled too. D218.

import { HOUR_OF_GLORY } from '../../../data/fixtures/engineCards';
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
  HOUR_OF_GLORY,
  'Exile target creature. If that creature was a God, its controller reveals their hand and exiles all cards from it with the same name as that creature.',
);

export const HOUR_OF_GLORY_SCRIPT: CardScript = {
  oracleId: HOUR_OF_GLORY.oracleId,
  name: HOUR_OF_GLORY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const wasGod = ctx.derive(target.id).typeLine.subtypes.includes('God');
      const name = ctx.oracle.byPrinting(victim.printingId)?.name;
      const controller = victim.controller;
      const moves = [];
      moves.push({
        card: target.id,
        from: { kind: 'battlefield' as const, player: controller },
        to: { kind: 'exile' as const, player: victim.owner },
      });
      const events: EventBody[] = [];
      if (wasGod) {
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
      }
      events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
