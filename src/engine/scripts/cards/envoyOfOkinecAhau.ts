// `Envoy of Okinec Ahau` — "{4}{W}: Create a 1/1 colorless Gnome artifact
// creature token." Dragon Roost's repeatable mana-only faucet on a creature
// with no tap in the cost. M6.4q, D173.

import { ENVOY_OF_OKINEC_AHAU } from '../../../data/fixtures/engineCards';
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
  ENVOY_OF_OKINEC_AHAU,
  '{4}{W}: Create a 1/1 colorless Gnome artifact creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GNOME = tokenRef('Gnome|1/1||Artifact Creature|');

export const ENVOY_OF_OKINEC_AHAU_SCRIPT: CardScript = {
  oracleId: ENVOY_OF_OKINEC_AHAU.oracleId,
  name: ENVOY_OF_OKINEC_AHAU.name,
  activated: [
    {
      ref: `${ENVOY_OF_OKINEC_AHAU.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GNOME.oracleId,
          printingId: GNOME.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
