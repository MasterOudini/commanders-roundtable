// `Crested Herdcaller` — "Trample\nWhen this creature enters, create a 3/3
// green Dinosaur creature token with trample." The token's trample is what
// distinguishes its printing from the vanilla 3/3 Dinosaur one row over in
// the table (D131: abilities are identity). M6.4l, D169.

import { CRESTED_HERDCALLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  CRESTED_HERDCALLER,
  'Trample\nWhen this creature enters, create a 3/3 green Dinosaur creature token with trample.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const DINOSAUR = tokenRef('Dinosaur|3/3|G|Creature|trample');

export const CRESTED_HERDCALLER_SCRIPT: CardScript = {
  oracleId: CRESTED_HERDCALLER.oracleId,
  name: CRESTED_HERDCALLER.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Crested Herdcaller — create a 3/3 Dinosaur with trample',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: DINOSAUR.oracleId,
          printingId: DINOSAUR.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
