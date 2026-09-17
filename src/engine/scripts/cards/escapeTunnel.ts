// `Escape Tunnel` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ESCAPE_TUNNEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ESCAPE_TUNNEL, "{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\n{T}, Sacrifice this land: Target creature with power 2 or less can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", ESCAPE_TUNNEL.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");
const VOCAB_A1 = vocabularyEffects("Target creature with power 2 or less can't be blocked this turn.", ESCAPE_TUNNEL.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature with power 2 or less can't be blocked this turn.");

export const ESCAPE_TUNNEL_SCRIPT: CardScript = {
  oracleId: ESCAPE_TUNNEL.oracleId,
  name: ESCAPE_TUNNEL.name,
  activated: [
    {
      ref: `${ESCAPE_TUNNEL.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ESCAPE_TUNNEL.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
