// `Titan Forge` - an activation selfCounter, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TITAN_FORGE } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(TITAN_FORGE, "{3}, {T}: Put a charge counter on this artifact.\n{T}, Remove three charge counters from this artifact: Create a 9/9 colorless Golem artifact creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Golem|9/9||Artifact Creature|");

export const TITAN_FORGE_SCRIPT: CardScript = {
  oracleId: TITAN_FORGE.oracleId,
  name: TITAN_FORGE.name,
  activated: [
    {
      ref: `${TITAN_FORGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "charge", delta: 1 }] }];
      },
    },
    {
      ref: `${TITAN_FORGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_1.oracleId,
          printingId: TOKEN_1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
