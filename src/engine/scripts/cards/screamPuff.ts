// `Scream Puff` — "Deathtouch / Whenever this creature deals combat
// damage to a player, create a Food token." Hoard Robber's connect
// paying Food. D244.

import { SCREAM_PUFF } from '../../../data/fixtures/engineCards';
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
  SCREAM_PUFF,
  'Deathtouch\nWhenever this creature deals combat damage to a player, create a Food token. ' +
    '(It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FOOD = tokenRef('Food|/||Artifact|');

export const SCREAM_PUFF_SCRIPT: CardScript = {
  oracleId: SCREAM_PUFF.oracleId,
  name: SCREAM_PUFF.name,
  triggers: [
    {
      abilityId: 'hit-player-food',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Scream Puff — create a Food token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: FOOD.oracleId,
          printingId: FOOD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
