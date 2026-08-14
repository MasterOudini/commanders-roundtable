// `Junktown` — Land, "{T}: Add {C}.\n{4}{R}, {T}, Sacrifice this land:
// Create three Junk tokens." The self-sacrifice paying THREE Junk with
// distinct ids (D164); the Junk's own ability is the token's (the Blood
// precedent). M6.4aa, D183.

import { JUNKTOWN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  JUNKTOWN,
  '{T}: Add {C}.\n{4}{R}, {T}, Sacrifice this land: Create three Junk tokens. ' +
    '(They\'re artifacts with "{T}, Sacrifice this token: Exile the top card of your library. ' +
    'You may play that card this turn. Activate only as a sorcery.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const JUNK = tokenRef('Junk|/||Artifact|');

export const JUNKTOWN_SCRIPT: CardScript = {
  oracleId: JUNKTOWN.oracleId,
  name: JUNKTOWN.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the Junk maker as ability 1.
      ref: `${JUNKTOWN.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1, 2].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: JUNK.oracleId,
          printingId: JUNK.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
