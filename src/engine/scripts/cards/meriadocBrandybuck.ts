// `Meriadoc Brandybuck` — "Whenever one or more Halflings you control attack
// a player, create a Food token." The FIRST def to read `DefenderRef`: the
// batch is per DECLARATION (the printed "one or more"), and only attackers
// whose defender is a PLAYER count — a planeswalker swing pays nothing.
// Meriadoc is himself a Halfling and counts. M6.4ad, D186.

import { MERIADOC_BRANDYBUCK } from '../../../data/fixtures/engineCards';
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
  MERIADOC_BRANDYBUCK,
  'Whenever one or more Halflings you control attack a player, create a Food token. ' +
    '(It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FOOD = tokenRef('Food|/||Artifact|');

export const MERIADOC_BRANDYBUCK_SCRIPT: CardScript = {
  oracleId: MERIADOC_BRANDYBUCK.oracleId,
  name: MERIADOC_BRANDYBUCK.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.some((a) => {
          if (a.defender.kind !== 'player') return false;
          if (ctx.query.controllerOf(a.card) !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(a.card).typeLine.subtypes.includes('Halfling');
        }),
      label: () => 'Meriadoc Brandybuck — create a Food token',
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
