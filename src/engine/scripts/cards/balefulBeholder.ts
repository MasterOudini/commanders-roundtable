// `Baleful Beholder` - a etb trigger vocab, a etb trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BALEFUL_BEHOLDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BALEFUL_BEHOLDER, "When this creature enters, choose one —\n• Antimagic Cone — Each opponent sacrifices an enchantment of their choice.\n• Fear Ray — Creatures you control gain menace until end of turn. (A creature with menace can't be blocked except by two or more creatures.)");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Antimagic Cone — Each opponent sacrifices an enchantment of their choice.", targets: vocabularyTargets("Each opponent sacrifices an enchantment of their choice.") },
  { text: "Fear Ray — Creatures you control gain menace until end of turn.", targets: vocabularyTargets("Creatures you control gain menace until end of turn.") },
];

const VOCAB_L0_m0 = vocabularyEffects("Each opponent sacrifices an enchantment of their choice.", BALEFUL_BEHOLDER.name);
const VOCAB_T_L0_m0 = vocabularyTargets("Each opponent sacrifices an enchantment of their choice.");

export const BALEFUL_BEHOLDER_SCRIPT: CardScript = {
  oracleId: BALEFUL_BEHOLDER.oracleId,
  name: BALEFUL_BEHOLDER.name,
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
      label: () => "Baleful Beholder - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L0_m0, VOCAB_T_L0_m0);
        }
        if (chosen === 1) {
          const out: EventBody[] = [];
          for (const inst of Object.values(ctx.state.cards)) {
            if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
            if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
            out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["menace"] });
          }
          return out;
        }
        return [];
      },
    },
  ],
};
