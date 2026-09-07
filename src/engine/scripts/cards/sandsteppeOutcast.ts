// `Sandsteppe Outcast` - a etb trigger selfCounter, a etb trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SANDSTEPPE_OUTCAST } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(SANDSTEPPE_OUTCAST, "When this creature enters, choose one —\n• Put a +1/+1 counter on this creature.\n• Create a 1/1 white Spirit creature token with flying.");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m1 = tokenRef("Spirit|1/1|W|Creature|flying");

const MODES_L0 = [
  { text: "Put a +1/+1 counter on this creature.", targets: vocabularyTargets("Put a +1/+1 counter on ~.") },
  { text: "Create a 1/1 white Spirit creature token with flying.", targets: vocabularyTargets("Create a 1/1 white Spirit creature token with flying.") },
];

export const SANDSTEPPE_OUTCAST_SCRIPT: CardScript = {
  oracleId: SANDSTEPPE_OUTCAST.oracleId,
  name: SANDSTEPPE_OUTCAST.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sandsteppe Outcast - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
        }
        if (chosen === 1) {
          return Array.from({ length: 1 }, () => ({
            t: 'TokenCreated' as const,
            card: ctx.ids.nextInstance(),
            oracleId: TOKEN_L0_m1.oracleId,
            printingId: TOKEN_L0_m1.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          }));
        }
        return [];
      },
    },
  ],
};
