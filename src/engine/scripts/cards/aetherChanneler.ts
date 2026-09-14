// `Aether Channeler` - a etb trigger token, a etb trigger vocab, a etb trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AETHER_CHANNELER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(AETHER_CHANNELER, "When this creature enters, choose one —\n• Create a 1/1 white Bird creature token with flying.\n• Return another target nonland permanent to its owner's hand.\n• Draw a card.");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m0 = tokenRef("Bird|1/1|W|Creature|flying");

const MODES_L0 = [
  { text: "Create a 1/1 white Bird creature token with flying.", targets: vocabularyTargets("Create a 1/1 white Bird creature token with flying.") },
  { text: "Return another target nonland permanent to its owner's hand.", targets: vocabularyTargets("Return another target nonland permanent to its owner's hand.") },
  { text: "Draw a card.", targets: vocabularyTargets("Draw a card.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Return another target nonland permanent to its owner's hand.", AETHER_CHANNELER.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Return another target nonland permanent to its owner's hand.");

export const AETHER_CHANNELER_SCRIPT: CardScript = {
  oracleId: AETHER_CHANNELER.oracleId,
  name: AETHER_CHANNELER.name,
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
      label: () => "Aether Channeler - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
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
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        if (chosen === 2) {
          return drawEvents(ctx.state, obj.controller, 1);
        }
        return [];
      },
    },
  ],
};
