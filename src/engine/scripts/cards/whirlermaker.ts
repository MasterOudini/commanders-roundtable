// `Whirlermaker` — "{4}, {T}: Create a 1/1 colorless Thopter artifact
// creature token with flying." Jade Mage's repeatable token active with a tap
// in the cost, on the Thopter pin Foundry of the Consuls already uses. D269.

import { WHIRLERMAKER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  WHIRLERMAKER,
  '{4}, {T}: Create a 1/1 colorless Thopter artifact creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const THOPTER = tokenRef('Thopter|1/1||Artifact Creature|flying');

export const WHIRLERMAKER_SCRIPT: CardScript = {
  oracleId: WHIRLERMAKER.oracleId,
  name: WHIRLERMAKER.name,
  activated: [
    {
      ref: `${WHIRLERMAKER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: THOPTER.oracleId,
          printingId: THOPTER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
