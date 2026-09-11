// `Access Tunnel` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ACCESS_TUNNEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ACCESS_TUNNEL, "{T}: Add {C}.\n{3}, {T}: Target creature with power 3 or less can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target creature with power 3 or less can't be blocked this turn.", ACCESS_TUNNEL.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature with power 3 or less can't be blocked this turn.");

export const ACCESS_TUNNEL_SCRIPT: CardScript = {
  oracleId: ACCESS_TUNNEL.oracleId,
  name: ACCESS_TUNNEL.name,
  activated: [
    {
      ref: `${ACCESS_TUNNEL.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
