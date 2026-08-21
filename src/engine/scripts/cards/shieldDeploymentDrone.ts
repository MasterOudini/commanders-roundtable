// `S.H.I.E.L.D. Deployment Drone` — "Flying / When this creature enters,
// create a 1/1 white Soldier creature token." The ETB Soldier on the
// committed t40k pin. D242.

import { S_H_I_E_L_D_DEPLOYMENT_DRONE } from '../../../data/fixtures/engineCards';
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
  S_H_I_E_L_D_DEPLOYMENT_DRONE,
  'Flying\nWhen this creature enters, create a 1/1 white Soldier creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SOLDIER = tokenRef('Soldier|1/1|W|Creature|');

export const SHIELD_DEPLOYMENT_DRONE_SCRIPT: CardScript = {
  oracleId: S_H_I_E_L_D_DEPLOYMENT_DRONE.oracleId,
  name: S_H_I_E_L_D_DEPLOYMENT_DRONE.name,
  triggers: [
    {
      abilityId: 'etb-soldier',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'S.H.I.E.L.D. Deployment Drone — create a 1/1 Soldier',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SOLDIER.oracleId,
          printingId: SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
