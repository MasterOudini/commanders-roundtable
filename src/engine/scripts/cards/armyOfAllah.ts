// `Army of Allah` — "Attacking creatures get +2/+0 until end of turn." One
// PtModified per declared attacker still on the battlefield, read off the
// live combat state (Aetherize's read, D197) — cast after blockers, the
// pump still lands before damage. D198.

import { ARMY_OF_ALLAH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ARMY_OF_ALLAH, 'Attacking creatures get +2/+0 until end of turn.');

export const ARMY_OF_ALLAH_SCRIPT: CardScript = {
  oracleId: ARMY_OF_ALLAH.oracleId,
  name: ARMY_OF_ALLAH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const a of ctx.state.combat?.attackers ?? []) {
        if (ctx.state.cards[a.card]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: a.card, power: 2, toughness: 0 });
      }
      return events;
    },
  },
};
