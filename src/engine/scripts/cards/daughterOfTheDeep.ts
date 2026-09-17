// `Daughter of the Deep` - a secondCard trigger token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAUGHTER_OF_THE_DEEP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAUGHTER_OF_THE_DEEP, "Whenever you draw your second card each turn, create a 1/1 blue Merfolk creature token.\n{U}, {T}: Target Merfolk can't be blocked this turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Merfolk|1/1|U|Creature|");

const VOCAB_A0 = vocabularyEffects("Target Merfolk can't be blocked this turn.", DAUGHTER_OF_THE_DEEP.name);
const VOCAB_T_A0 = vocabularyTargets("Target Merfolk can't be blocked this turn.");

export const DAUGHTER_OF_THE_DEEP_SCRIPT: CardScript = {
  oracleId: DAUGHTER_OF_THE_DEEP.oracleId,
  name: DAUGHTER_OF_THE_DEEP.name,
  activated: [
    {
      ref: `${DAUGHTER_OF_THE_DEEP.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: LINES[0] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Daughter of the Deep - token",
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
