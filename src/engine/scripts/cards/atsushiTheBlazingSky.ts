// `Atsushi, the Blazing Sky` - a dies trigger vocab, a dies trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ATSUSHI_THE_BLAZING_SKY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ATSUSHI_THE_BLAZING_SKY, "Flying, trample\nWhen Atsushi dies, choose one —\n• Exile the top two cards of your library. Until the end of your next turn, you may play those cards.\n• Create three Treasure tokens.");
const LINES = PRINTED.split('\n');
const TOKEN_L1_m1 = tokenRef("Treasure|/||Artifact|");

const MODES_L1 = [
  { text: "Exile the top two cards of your library. Until the end of your next turn, you may play those cards.", targets: vocabularyTargets("Exile the top two cards of your library. Until the end of your next turn, you may play those cards.") },
  { text: "Create three Treasure tokens.", targets: vocabularyTargets("Create three Treasure tokens.") },
];

const VOCAB_L1_m0 = vocabularyEffects("Exile the top two cards of your library. Until the end of your next turn, you may play those cards.", ATSUSHI_THE_BLAZING_SKY.name);
const VOCAB_T_L1_m0 = vocabularyTargets("Exile the top two cards of your library. Until the end of your next turn, you may play those cards.");

export const ATSUSHI_THE_BLAZING_SKY_SCRIPT: CardScript = {
  oracleId: ATSUSHI_THE_BLAZING_SKY.oracleId,
  name: ATSUSHI_THE_BLAZING_SKY.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Atsushi, the Blazing Sky - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L1_m0, VOCAB_T_L1_m0);
        }
        if (chosen === 1) {
          return Array.from({ length: 3 }, () => ({
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
