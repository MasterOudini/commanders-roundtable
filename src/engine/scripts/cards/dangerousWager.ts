// `Dangerous Wager` — "Discard your hand, then draw two cards." The wheel's
// no-choice whole-hand discard (CR 701.8a) for the caster alone, the two
// through THE draw rule. The spell itself is on the stack, never in the
// counted hand. D206.

import { DANGEROUS_WAGER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(DANGEROUS_WAGER, 'Discard your hand, then draw two cards.');

export const DANGEROUS_WAGER_SCRIPT: CardScript = {
  oracleId: DANGEROUS_WAGER.oracleId,
  name: DANGEROUS_WAGER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.hand[obj.controller] ?? []) {
        moves.push({
          card: id,
          from: { kind: 'hand' as const, player: obj.controller },
          to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? obj.controller },
        });
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      events.push(...drawEvents(ctx.state, obj.controller, 2));
      return events;
    },
  },
};
