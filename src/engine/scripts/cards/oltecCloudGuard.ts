// `Oltec Cloud Guard` — "When this creature enters, create a 1/1 colorless
// Gnome artifact creature token." D230.

import { OLTEC_CLOUD_GUARD } from '../../../data/fixtures/engineCards';
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
  OLTEC_CLOUD_GUARD,
  'Flying\nWhen this creature enters, create a 1/1 colorless Gnome artifact creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GNOME = tokenRef('Gnome|1/1||Artifact Creature|');

export const OLTEC_CLOUD_GUARD_SCRIPT: CardScript = {
  oracleId: OLTEC_CLOUD_GUARD.oracleId,
  name: OLTEC_CLOUD_GUARD.name,
  triggers: [
    {
      abilityId: 'etb-gnome',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Oltec Cloud Guard — create a 1/1 Gnome',
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
