// `Morale` — "Attacking creatures get +1/+1 until end of turn." The
// combat-wide pump over every declared attacker still standing. D226.

import { MORALE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MORALE, 'Attacking creatures get +1/+1 until end of turn.');

export const MORALE_SCRIPT: CardScript = {
  oracleId: MORALE.oracleId,
  name: MORALE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const a of ctx.state.combat?.attackers ?? []) {
        const card = ctx.state.cards[a.card];
        if (!card || card.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: a.card, power: 1, toughness: 1 });
      }
      return events;
    },
  },
};
