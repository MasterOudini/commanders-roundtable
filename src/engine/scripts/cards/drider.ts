// `Drider` — "Reach\nWhenever this creature deals combat damage to a player,
// create a 2/1 black Spider creature token with menace and reach."
// Belligerent Guest's self-only hit-a-player shape, on a Spider whose
// printing is distinct from the 1/2 by nothing but its abilities (D131).
// M6.4p, D172.

import { DRIDER } from '../../../data/fixtures/engineCards';
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
  DRIDER,
  'Reach\nWhenever this creature deals combat damage to a player, create a 2/1 black Spider creature token with menace and reach.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIDER = tokenRef('Spider|2/1|B|Creature|menace|reach');

export const DRIDER_SCRIPT: CardScript = {
  oracleId: DRIDER.oracleId,
  name: DRIDER.name,
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
      label: () => 'Drider — create a 2/1 Spider with menace and reach',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIDER.oracleId,
          printingId: SPIDER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
