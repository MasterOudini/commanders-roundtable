// `Hold the Line` — BLOCKING creatures get +7/+7: the combat state's
// blocker list read mid-combat (Fight to the Death's other half). D217.

import { HOLD_THE_LINE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HOLD_THE_LINE, 'Blocking creatures get +7/+7 until end of turn.');

export const HOLD_THE_LINE_SCRIPT: CardScript = {
  oracleId: HOLD_THE_LINE.oracleId,
  name: HOLD_THE_LINE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const b of ctx.state.combat?.blockers ?? []) {
        if (!ctx.state.cards[b.card]) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: b.card, power: 7, toughness: 7 });
      }
      return events;
    },
  },
};
