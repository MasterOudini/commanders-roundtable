// `Urza's Factory` — the activated token at #a1: a MANA line counts as
// ability 0, so the {7}, {T} sits at index 1. D265.

import { URZA_S_FACTORY } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(
  URZA_S_FACTORY,
  '{T}: Add {C}.\n{7}, {T}: Create a 2/2 colorless Assembly-Worker artifact creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

const WORKER = tokenRef('Assembly-Worker|2/2||Artifact Creature|');

export const URZAS_FACTORY_SCRIPT: CardScript = {
  oracleId: URZA_S_FACTORY.oracleId,
  name: URZA_S_FACTORY.name,
  activated: [
    {
      ref: `${URZA_S_FACTORY.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: WORKER.oracleId,
          printingId: WORKER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
