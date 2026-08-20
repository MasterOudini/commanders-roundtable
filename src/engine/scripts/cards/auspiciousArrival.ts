// `Auspicious Arrival` — "Target creature gets +2/+2 until end of turn.
// Investigate." The pump plus the Clue on TOKEN_TABLE's own pin — the token's
// activated ability is disclosed on the token itself (the Blood precedent,
// D174), so creating it is not half-execution. The Clue arrives even if the
// target has gone (CR 608.2b removes the illegal half only). D198.

import { AUSPICIOUS_ARRIVAL } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  AUSPICIOUS_ARRIVAL,
  'Target creature gets +2/+2 until end of turn. Investigate. (Create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CLUE = tokenRef('Clue|/||Artifact|');

export const AUSPICIOUS_ARRIVAL_SCRIPT: CardScript = {
  oracleId: AUSPICIOUS_ARRIVAL.oracleId,
  name: AUSPICIOUS_ARRIVAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const target = obj.targets[0];
      if (target && target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind === 'battlefield') {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 });
      }
      events.push({
        t: 'TokenCreated',
        card: ctx.ids.nextInstance(),
        oracleId: CLUE.oracleId,
        printingId: CLUE.printingId,
        controller: obj.controller,
        owner: obj.controller,
        turnNumber: ctx.state.turn.turnNumber,
      });
      return events;
    },
  },
};
