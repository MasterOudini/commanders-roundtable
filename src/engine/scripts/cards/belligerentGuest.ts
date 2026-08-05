// `Belligerent Guest` — "Whenever this creature deals combat damage to a
// player, create a Blood token." The first COMBAT-DAMAGE trigger — safe where
// Aya of Alexandria is not (D164's refusal), because it watches only ITSELF:
// one creature attacks one defender, so its player-damage is at most one
// entry per `CombatDamageDealt` and per-event firing IS per-instance firing.
// M6.4g, D164.

import { BELLIGERENT_GUEST } from '../../../data/fixtures/engineCards';
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
  BELLIGERENT_GUEST,
  "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\n" +
    'Whenever this creature deals combat damage to a player, create a Blood token. ' +
    '(It\'s an artifact with "{1}, {T}, Discard a card, Sacrifice this token: Draw a card.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BLOOD = tokenRef('Blood|/||Artifact|');

export const BELLIGERENT_GUEST_SCRIPT: CardScript = {
  oracleId: BELLIGERENT_GUEST.oracleId,
  name: BELLIGERENT_GUEST.name,
  triggers: [
    {
      abilityId: 'hit-player',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Belligerent Guest — create a Blood token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BLOOD.oracleId,
          printingId: BLOOD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
