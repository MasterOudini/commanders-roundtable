// `Exhibition Magician` - a etb trigger token, a etb trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXHIBITION_MAGICIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXHIBITION_MAGICIAN, "When this creature enters, choose one —\n• Create a 1/1 green and white Citizen creature token.\n• Create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m0 = tokenRef("Citizen|1/1|GW|Creature|");
const TOKEN_L0_m1 = tokenRef("Treasure|/||Artifact|");

const MODES_L0 = [
  { text: "Create a 1/1 green and white Citizen creature token.", targets: vocabularyTargets("Create a 1/1 green and white Citizen creature token.") },
  { text: "Create a Treasure token.", targets: vocabularyTargets("Create a Treasure token.") },
];

export const EXHIBITION_MAGICIAN_SCRIPT: CardScript = {
  oracleId: EXHIBITION_MAGICIAN.oracleId,
  name: EXHIBITION_MAGICIAN.name,
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
      label: () => "Exhibition Magician - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return Array.from({ length: 1 }, () => ({
            t: 'TokenCreated' as const,
            card: ctx.ids.nextInstance(),
            oracleId: TOKEN_L0_m0.oracleId,
            printingId: TOKEN_L0_m0.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          }));
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
