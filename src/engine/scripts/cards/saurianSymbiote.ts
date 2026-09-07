// `Saurian Symbiote` - a etb trigger selfCounter, a etb trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAURIAN_SYMBIOTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAURIAN_SYMBIOTE, "Reach (This creature can block creatures with flying.)\nWhen this creature enters, choose one —\n• Put a +1/+1 counter on this creature.\n• Create a 1/1 green Saproling creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L1_m1 = tokenRef("Saproling|1/1|G|Creature|");

const MODES_L1 = [
  { text: "Put a +1/+1 counter on this creature.", targets: vocabularyTargets("Put a +1/+1 counter on ~.") },
  { text: "Create a 1/1 green Saproling creature token.", targets: vocabularyTargets("Create a 1/1 green Saproling creature token.") },
];

export const SAURIAN_SYMBIOTE_SCRIPT: CardScript = {
  oracleId: SAURIAN_SYMBIOTE.oracleId,
  name: SAURIAN_SYMBIOTE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Saurian Symbiote - choose one",
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
            oracleId: TOKEN_L1_m1.oracleId,
            printingId: TOKEN_L1_m1.printingId,
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
