// `Myr Turbine` - an activation token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MYR_TURBINE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(MYR_TURBINE, "{T}: Create a 1/1 colorless Myr artifact creature token.\n{T}, Tap five untapped Myr you control: Search your library for a Myr creature card, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Myr|1/1||Artifact Creature|");

const VOCAB_A1 = vocabularyEffects("Search your library for a Myr creature card, put it onto the battlefield, then shuffle.", MYR_TURBINE.name);
const VOCAB_T_A1 = vocabularyTargets("Search your library for a Myr creature card, put it onto the battlefield, then shuffle.");

export const MYR_TURBINE_SCRIPT: CardScript = {
  oracleId: MYR_TURBINE.oracleId,
  name: MYR_TURBINE.name,
  activated: [
    {
      ref: `${MYR_TURBINE.oracleId}#a0`,
      text: LINES[0] as string,
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
    {
      ref: `${MYR_TURBINE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
