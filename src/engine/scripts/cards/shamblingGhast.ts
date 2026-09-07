// `Shambling Ghast` - a dies trigger vocab, a dies trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHAMBLING_GHAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHAMBLING_GHAST, "When this creature dies, choose one —\n• Target creature an opponent controls gets -1/-1 until end of turn.\n• Create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m1 = tokenRef("Treasure|/||Artifact|");

const MODES_L0 = [
  { text: "Target creature an opponent controls gets -1/-1 until end of turn.", targets: vocabularyTargets("Target creature an opponent controls gets -1/-1 until end of turn.") },
  { text: "Create a Treasure token.", targets: vocabularyTargets("Create a Treasure token.") },
];

const VOCAB_L0_m0 = vocabularyEffects("Target creature an opponent controls gets -1/-1 until end of turn.", SHAMBLING_GHAST.name);
const VOCAB_T_L0_m0 = vocabularyTargets("Target creature an opponent controls gets -1/-1 until end of turn.");

export const SHAMBLING_GHAST_SCRIPT: CardScript = {
  oracleId: SHAMBLING_GHAST.oracleId,
  name: SHAMBLING_GHAST.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Shambling Ghast - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
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
