// `Trigon of Infestation` - a static entersWithCounters, an activation selfCounter, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRIGON_OF_INFESTATION } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(TRIGON_OF_INFESTATION, "This artifact enters with three charge counters on it.\n{G}{G}, {T}: Put a charge counter on this artifact.\n{2}, {T}, Remove a charge counter from this artifact: Create a 1/1 green Phyrexian Insect creature token with infect.");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Phyrexian Insect|1/1|G|Creature|infect");

export const TRIGON_OF_INFESTATION_SCRIPT: CardScript = {
  oracleId: TRIGON_OF_INFESTATION.oracleId,
  name: TRIGON_OF_INFESTATION.name,
  activated: [
    {
      ref: `${TRIGON_OF_INFESTATION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "charge", delta: 1 }] }];
      },
    },
    {
      ref: `${TRIGON_OF_INFESTATION.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_1.oracleId,
          printingId: TOKEN_1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "charge", delta: 3 }] }],
    },
  ],
};
