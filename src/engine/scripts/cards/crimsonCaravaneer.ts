// `Crimson Caravaneer` — "Double strike, trample\nWhenever this creature
// deals combat damage to a player, create a Junk token." Belligerent Guest's
// SELF-only combat-damage shape (per-event firing IS per-instance when the
// filter is self, D164's granularity rule) — and a double striker genuinely
// triggers TWICE, once per sub-step, which the test pins. The Junk is a
// predefined artifact whose ability is its own (D132). M6.4l, D169.

import { CRIMSON_CARAVANEER } from '../../../data/fixtures/engineCards';
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
  CRIMSON_CARAVANEER,
  'Double strike, trample\nWhenever this creature deals combat damage to a player, create a Junk token. (It\'s an artifact with "{T}, Sacrifice this token: Exile the top card of your library. You may play that card this turn. Activate only as a sorcery.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const JUNK = tokenRef('Junk|/||Artifact|');

export const CRIMSON_CARAVANEER_SCRIPT: CardScript = {
  oracleId: CRIMSON_CARAVANEER.oracleId,
  name: CRIMSON_CARAVANEER.name,
  triggers: [
    {
      abilityId: 'combat-damage',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Crimson Caravaneer — create a Junk token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: JUNK.oracleId,
          printingId: JUNK.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
