// `Dawn of Hope` - a youGainLife trigger vocab, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAWN_OF_HOPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAWN_OF_HOPE, "Whenever you gain life, you may pay {2}. If you do, draw a card.\n{3}{W}: Create a 1/1 white Soldier creature token with lifelink.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Soldier|1/1|W|Creature|lifelink");

const VOCAB_L0 = vocabularyEffects("You may pay {2}. If you do, draw a card.", DAWN_OF_HOPE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}. If you do, draw a card.");

export const DAWN_OF_HOPE_SCRIPT: CardScript = {
  oracleId: DAWN_OF_HOPE.oracleId,
  name: DAWN_OF_HOPE.name,
  activated: [
    {
      ref: `${DAWN_OF_HOPE.oracleId}#a0`,
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
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: LINES[0] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Dawn of Hope - You may pay {2}. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
