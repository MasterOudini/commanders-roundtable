// `Sick and Tired` — "Two target creatures each get -1/-1 until end of
// turn." The counted pair (min 2 / max 2, probed) each debuffed. D247.

import { SICK_AND_TIRED } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SICK_AND_TIRED, 'Two target creatures each get -1/-1 until end of turn.');

export const SICK_AND_TIRED_SCRIPT: CardScript = {
  oracleId: SICK_AND_TIRED.oracleId,
  name: SICK_AND_TIRED.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 });
      }
      return events;
    },
  },
};
