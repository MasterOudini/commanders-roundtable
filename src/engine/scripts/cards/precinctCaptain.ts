// `Precinct Captain` — "Whenever this creature deals combat damage to a
// player, create a 1/1 white Soldier creature token." Belligerent
// Guest's connect trigger paying a Soldier; the First strike line is the
// engine's. D234.

import { PRECINCT_CAPTAIN } from '../../../data/fixtures/engineCards';
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
  PRECINCT_CAPTAIN,
  'First strike\nWhenever this creature deals combat damage to a player, create a 1/1 white Soldier creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SOLDIER = tokenRef('Soldier|1/1|W|Creature|');

export const PRECINCT_CAPTAIN_SCRIPT: CardScript = {
  oracleId: PRECINCT_CAPTAIN.oracleId,
  name: PRECINCT_CAPTAIN.name,
  triggers: [
    {
      abilityId: 'connect-soldier',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Precinct Captain — create a 1/1 white Soldier token',
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
