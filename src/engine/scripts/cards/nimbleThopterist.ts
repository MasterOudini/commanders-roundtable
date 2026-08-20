// `Nimble Thopterist` — "When this creature enters, create a 1/1 colorless
// Thopter artifact creature token with flying." The Aspiring Aeronaut's
// pinned Thopter on a fresh id. D228.

import { NIMBLE_THOPTERIST } from '../../../data/fixtures/engineCards';
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
  NIMBLE_THOPTERIST,
  'When this creature enters, create a 1/1 colorless Thopter artifact creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const THOPTER = tokenRef('Thopter|1/1||Artifact Creature|flying');

export const NIMBLE_THOPTERIST_SCRIPT: CardScript = {
  oracleId: NIMBLE_THOPTERIST.oracleId,
  name: NIMBLE_THOPTERIST.name,
  triggers: [
    {
      abilityId: 'etb-thopter',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Nimble Thopterist — create a 1/1 Thopter with flying',
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
