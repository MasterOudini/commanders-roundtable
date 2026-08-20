// `Hint of Insanity` — the public reveal, then the NAME-matched forced
// discard: every nonland card sharing its name with another card in
// that hand goes. Amnesia's reveal with Bile Blight's census. D217.

import { HINT_OF_INSANITY } from '../../../data/fixtures/engineCards';
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
  HINT_OF_INSANITY,
  'Target player reveals their hand. That player discards all nonland cards with the same name as another card in their hand.',
);

export const HINT_OF_INSANITY_SCRIPT: CardScript = {
  oracleId: HINT_OF_INSANITY.oracleId,
  name: HINT_OF_INSANITY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      if (ctx.state.players[target.id]?.hasLost) return [];
      const hand = ctx.state.zones.hand[target.id] ?? [];
      if (hand.length === 0) return [];
      const events: EventBody[] = [
        { t: 'CardsRevealed', cards: hand, to: ctx.state.seating },
      ];
      const names = new Map<string, number>();
      for (const id of hand) {
        const card = ctx.state.cards[id];
        const name = card && ctx.oracle.byPrinting(card.printingId)?.name;
        if (!name) continue;
        names.set(name, (names.get(name) ?? 0) + 1);
      }
      const moves = [];
      for (const id of hand) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        if ((names.get(oc.name) ?? 0) < 2) continue;
        if (faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Land')) continue;
        moves.push({
          card: id,
          from: { kind: 'hand' as const, player: target.id },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
