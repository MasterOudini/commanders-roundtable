// `Kykar, Zephyr Awakener` - a castNoncreature trigger vocab, a castNoncreature trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KYKAR_ZEPHYR_AWAKENER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KYKAR_ZEPHYR_AWAKENER, "Flying\nWhenever you cast a noncreature spell, choose one —\n• Exile another target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.\n• Create a 1/1 white Spirit creature token with flying.");
const LINES = PRINTED.split('\n');
const TOKEN_L1_m1 = tokenRef("Spirit|1/1|W|Creature|flying");

const MODES_L1 = [
  { text: "Exile another target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.", targets: vocabularyTargets("Exile another target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.") },
  { text: "Create a 1/1 white Spirit creature token with flying.", targets: vocabularyTargets("Create a 1/1 white Spirit creature token with flying.") },
];

const VOCAB_L1_m0 = vocabularyEffects("Exile another target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.", KYKAR_ZEPHYR_AWAKENER.name);
const VOCAB_T_L1_m0 = vocabularyTargets("Exile another target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

export const KYKAR_ZEPHYR_AWAKENER_SCRIPT: CardScript = {
  oracleId: KYKAR_ZEPHYR_AWAKENER.oracleId,
  name: KYKAR_ZEPHYR_AWAKENER.name,
  triggers: [
    {
      abilityId: 'castNoncreature-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Kykar, Zephyr Awakener - choose one",
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
        return [];
      },
    },
  ],
};
