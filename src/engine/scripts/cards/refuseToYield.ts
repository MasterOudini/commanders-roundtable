// `Refuse to Yield` — "Target creature gets +2/+7 until end of turn.
// Untap it." The pump-and-untap. D238.

import { REFUSE_TO_YIELD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(REFUSE_TO_YIELD, 'Target creature gets +2/+7 until end of turn. Untap it.');

export const REFUSE_TO_YIELD_SCRIPT: CardScript = {
  oracleId: REFUSE_TO_YIELD.oracleId,
  name: REFUSE_TO_YIELD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 7 },
      ];
      if (card.tapped) events.push({ t: 'PermanentsUntapped', cards: [target.id] });
      return events;
    },
  },
};
