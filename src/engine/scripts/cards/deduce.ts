// `Deduce` — "Draw a card. Investigate." THE draw rule plus one Clue. D207.

import { DEDUCE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const TEXT = printed(
  DEDUCE,
  'Draw a card. Investigate. (Create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CLUE = tokenRef('Clue|/||Artifact|');

export const DEDUCE_SCRIPT: CardScript = {
  oracleId: DEDUCE.oracleId,
  name: DEDUCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => [
      ...drawEvents(ctx.state, obj.controller, 1),
      {
        t: 'TokenCreated',
        card: ctx.ids.nextInstance(),
        oracleId: CLUE.oracleId,
        printingId: CLUE.printingId,
        controller: obj.controller,
        owner: obj.controller,
        turnNumber: ctx.state.turn.turnNumber,
      },
    ],
  },
};
