// `Yavimaya Sapherd` — the untargeted ETB Saproling, on the pin Jade Mage and
// Vitu-Ghazi already use. D271.

import { YAVIMAYA_SAPHERD } from '../../../data/fixtures/engineCards';
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
  YAVIMAYA_SAPHERD,
  'When this creature enters, create a 1/1 green Saproling creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const YAVIMAYA_SAPHERD_SCRIPT: CardScript = {
  oracleId: YAVIMAYA_SAPHERD.oracleId,
  name: YAVIMAYA_SAPHERD.name,
  triggers: [
    {
      abilityId: 'etb-saproling',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Yavimaya Sapherd — create a 1/1 green Saproling creature token',
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
