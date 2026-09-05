// `Fountainport` - an activation draw, an activation token, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOUNTAINPORT } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(FOUNTAINPORT, "{T}: Add {C}.\n{2}, {T}, Sacrifice a token: Draw a card.\n{3}, {T}, Pay 1 life: Create a 1/1 blue Fish creature token.\n{4}, {T}: Create a Treasure token.");
const LINES = PRINTED.split('\n');
const TOKEN_2 = tokenRef("Fish|1/1|U|Creature|");
const TOKEN_3 = tokenRef("Treasure|/||Artifact|");

export const FOUNTAINPORT_SCRIPT: CardScript = {
  oracleId: FOUNTAINPORT.oracleId,
  name: FOUNTAINPORT.name,
  activated: [
    {
      ref: `${FOUNTAINPORT.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      ref: `${FOUNTAINPORT.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_2.oracleId,
          printingId: TOKEN_2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
    {
      ref: `${FOUNTAINPORT.oracleId}#a3`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_3.oracleId,
          printingId: TOKEN_3.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
