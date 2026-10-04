// `Sanar, Unfinished Genius // Wild Idea` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SANAR_UNFINISHED_GENIUS_WILD_IDEA } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(SANAR_UNFINISHED_GENIUS_WILD_IDEA, "Sanar enters prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\n{T}: Create a Treasure token. Activate only if you've cast an instant or sorcery spell this turn.\nSearch your library for an instant or sorcery card, reveal it, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Treasure|/||Artifact|");

export const SANAR_UNFINISHED_GENIUS_WILD_IDEA_SCRIPT: CardScript = {
  oracleId: SANAR_UNFINISHED_GENIUS_WILD_IDEA.oracleId,
  name: SANAR_UNFINISHED_GENIUS_WILD_IDEA.name,
  activated: [
    {
      ref: `${SANAR_UNFINISHED_GENIUS_WILD_IDEA.oracleId}#a0`, face: 0,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
