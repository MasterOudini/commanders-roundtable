// `Attended Healer` - a youGainLife trigger token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ATTENDED_HEALER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ATTENDED_HEALER, "Whenever you gain life for the first time each turn, create a 1/1 white Cat creature token.\n{2}{W}: Another target Cleric gains lifelink until end of turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Cat|1/1|W|Creature|");

const VOCAB_A0 = vocabularyEffects("Another target Cleric gains lifelink until end of turn.", ATTENDED_HEALER.name);
const VOCAB_T_A0 = vocabularyTargets("Another target Cleric gains lifelink until end of turn.");

export const ATTENDED_HEALER_SCRIPT: CardScript = {
  oracleId: ATTENDED_HEALER.oracleId,
  name: ATTENDED_HEALER.name,
  activated: [
    {
      ref: `${ATTENDED_HEALER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
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
      oncePerTurn: true,
      looksBack: true,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self) && ctx.state.turn.memory.gainedLife[ev.player] !== true,
      label: () => "Attended Healer - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
