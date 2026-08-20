// `Myr Sire` — "When this creature dies, create a 1/1 colorless Phyrexian
// Myr artifact creature token." The dies-token on a Myr that replaces
// itself. D227.

import { MYR_SIRE } from '../../../data/fixtures/engineCards';
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
  MYR_SIRE,
  'When this creature dies, create a 1/1 colorless Phyrexian Myr artifact creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MYR = tokenRef('Phyrexian Myr|1/1||Artifact Creature|');

export const MYR_SIRE_SCRIPT: CardScript = {
  oracleId: MYR_SIRE.oracleId,
  name: MYR_SIRE.name,
  triggers: [
    {
      abilityId: 'dies-myr',
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
      label: () => 'Myr Sire — create a 1/1 Phyrexian Myr',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: MYR.oracleId,
          printingId: MYR.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
