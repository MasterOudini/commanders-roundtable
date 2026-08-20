// `Hope and Glory` — the counted pair: untap BOTH picks, +1/+1 each.
// D218.

import { HOPE_AND_GLORY } from '../../../data/fixtures/engineCards';
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
  HOPE_AND_GLORY,
  'Untap two target creatures. Each of them gets +1/+1 until end of turn.',
);

export const HOPE_AND_GLORY_SCRIPT: CardScript = {
  oracleId: HOPE_AND_GLORY.oracleId,
  name: HOPE_AND_GLORY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const untap = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (card.tapped) untap.push(target.id);
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 });
      }
      if (untap.length > 0) events.unshift({ t: 'PermanentsUntapped', cards: untap });
      return events;
    },
  },
};
