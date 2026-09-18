// `Plundering Barbarian` - a etb trigger vocab, a etb trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PLUNDERING_BARBARIAN } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(PLUNDERING_BARBARIAN, "When this creature enters, choose one —\n• Smash the Chest — Destroy target artifact.\n• Pry It Open — Create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m1 = tokenRef("Treasure|/||Artifact|");

const MODES_L0 = [
  { text: "Smash the Chest — Destroy target artifact.", targets: vocabularyTargets("Destroy target artifact.") },
  { text: "Pry It Open — Create a Treasure token.", targets: vocabularyTargets("Create a Treasure token.") },
];

const VOCAB_L0_m0 = vocabularyEffects("Destroy target artifact.", PLUNDERING_BARBARIAN.name);
const VOCAB_T_L0_m0 = vocabularyTargets("Destroy target artifact.");

export const PLUNDERING_BARBARIAN_SCRIPT: CardScript = {
  oracleId: PLUNDERING_BARBARIAN.oracleId,
  name: PLUNDERING_BARBARIAN.name,
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
      label: () => "Plundering Barbarian - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L0_m0, VOCAB_T_L0_m0);
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
