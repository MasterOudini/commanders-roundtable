// `Elspeth, Sun's Nemesis` - an activation vocab, an activation token, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELSPETH_SUN_S_NEMESIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELSPETH_SUN_S_NEMESIS, "−1: Up to two target creatures you control each get +2/+1 until end of turn.\n−2: Create two 1/1 white Human Soldier creature tokens.\n−3: You gain 5 life.\nEscape—{4}{W}{W}, Exile four other cards from your graveyard. (You may cast this card from your graveyard for its escape cost.)");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Human Soldier|1/1|W|Creature|");

const VOCAB_A0 = vocabularyEffects("Up to two target creatures you control each get +2/+1 until end of turn.", ELSPETH_SUN_S_NEMESIS.name);
const VOCAB_T_A0 = vocabularyTargets("Up to two target creatures you control each get +2/+1 until end of turn.");

export const ELSPETH_SUNS_NEMESIS_SCRIPT: CardScript = {
  oracleId: ELSPETH_SUN_S_NEMESIS.oracleId,
  name: ELSPETH_SUN_S_NEMESIS.name,
  activated: [
    {
      ref: `${ELSPETH_SUN_S_NEMESIS.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ELSPETH_SUN_S_NEMESIS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
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
    {
      ref: `${ELSPETH_SUN_S_NEMESIS.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 5, to: me.life + 5 }];
      },
    },
  ],
};
