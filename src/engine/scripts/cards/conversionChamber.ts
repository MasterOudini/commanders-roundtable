// `Conversion Chamber` - an activation vocab, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONVERSION_CHAMBER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONVERSION_CHAMBER, "{2}, {T}: Exile target artifact card from a graveyard. Put a charge counter on this artifact.\n{2}, {T}, Remove a charge counter from this artifact: Create a 3/3 colorless Phyrexian Golem artifact creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Phyrexian Golem|3/3||Artifact Creature|");

const VOCAB_A0 = vocabularyEffects("Exile target artifact card from a graveyard. Put a charge counter on ~.", CONVERSION_CHAMBER.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target artifact card from a graveyard. Put a charge counter on ~.");

export const CONVERSION_CHAMBER_SCRIPT: CardScript = {
  oracleId: CONVERSION_CHAMBER.oracleId,
  name: CONVERSION_CHAMBER.name,
  activated: [
    {
      ref: `${CONVERSION_CHAMBER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${CONVERSION_CHAMBER.oracleId}#a1`,
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
