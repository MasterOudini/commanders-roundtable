// `Deathbloom Thallid` — "When this creature dies, create a 1/1 green
// Saproling creature token." The dies-token on D165's Saproling pin.
// M6.4m, D170.

import { DEATHBLOOM_THALLID } from '../../../data/fixtures/engineCards';
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
  DEATHBLOOM_THALLID,
  'When this creature dies, create a 1/1 green Saproling creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const DEATHBLOOM_THALLID_SCRIPT: CardScript = {
  oracleId: DEATHBLOOM_THALLID.oracleId,
  name: DEATHBLOOM_THALLID.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Deathbloom Thallid — create a 1/1 Saproling',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SAPROLING.oracleId,
          printingId: SAPROLING.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
