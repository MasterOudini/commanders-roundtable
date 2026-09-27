// `Charming Scoundrel` - a etb trigger vocab, a etb trigger token, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHARMING_SCOUNDREL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHARMING_SCOUNDREL, "Haste\nWhen this creature enters, choose one —\n• Discard a card, then draw a card.\n• Create a Treasure token.\n• Create a Wicked Role token attached to target creature you control.");
const LINES = PRINTED.split('\n');
const TOKEN_L1_m1 = tokenRef("Treasure|/||Artifact|");

const MODES_L1 = [
  { text: "Discard a card, then draw a card.", targets: vocabularyTargets("Discard a card, then draw a card.") },
  { text: "Create a Treasure token.", targets: vocabularyTargets("Create a Treasure token.") },
  { text: "Create a Wicked Role token attached to target creature you control.", targets: vocabularyTargets("Create a Wicked Role token attached to target creature you control.") },
];

const VOCAB_L1_m0 = vocabularyEffects("Discard a card, then draw a card.", CHARMING_SCOUNDREL.name);
const VOCAB_T_L1_m0 = vocabularyTargets("Discard a card, then draw a card.");
const VOCAB_L1_m2 = vocabularyEffects("Create a Wicked Role token attached to target creature you control.", CHARMING_SCOUNDREL.name);
const VOCAB_T_L1_m2 = vocabularyTargets("Create a Wicked Role token attached to target creature you control.");

export const CHARMING_SCOUNDREL_SCRIPT: CardScript = {
  oracleId: CHARMING_SCOUNDREL.oracleId,
  name: CHARMING_SCOUNDREL.name,
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
      label: () => "Charming Scoundrel - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L1_m0, VOCAB_T_L1_m0);
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
        if (chosen === 2) {
          return ctx.vocabulary(obj, VOCAB_L1_m2, VOCAB_T_L1_m2);
        }
        return [];
      },
    },
  ],
};
