// `Rooftop Bypass` — "Whenever one or more nontoken creatures you
// control deal combat damage to a player, create a 1/1 black Assassin
// creature token with menace." The per-event batch IS the printed "one
// or more" (Keeper of Fables' argument); the dealer is checked nontoken,
// mine, a Creature, and hitting a PLAYER. D241.

import { ROOFTOP_BYPASS } from '../../../data/fixtures/engineCards';
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
  ROOFTOP_BYPASS,
  'Whenever one or more nontoken creatures you control deal combat damage to a player, create a 1/1 black Assassin creature token with menace. ' +
    "(It can't be blocked except by two or more creatures.)",
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ASSASSIN = tokenRef('Assassin|1/1|B|Creature|menace');

export const ROOFTOP_BYPASS_SCRIPT: CardScript = {
  oracleId: ROOFTOP_BYPASS.oracleId,
  name: ROOFTOP_BYPASS.name,
  triggers: [
    {
      abilityId: 'hit-player-assassin',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => {
          if (d.target.kind !== 'player' || d.amount <= 0) return false;
          const dealer = ctx.state.cards[d.source];
          if (!dealer || dealer.isToken) return false;
          if (dealer.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(d.source).typeLine.types.includes('Creature');
        }),
      label: () => 'Rooftop Bypass — create a 1/1 Assassin with menace',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ASSASSIN.oracleId,
          printingId: ASSASSIN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
