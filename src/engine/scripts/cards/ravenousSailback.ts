// `Ravenous Sailback` - a etb trigger pumping itself, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAVENOUS_SAILBACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAVENOUS_SAILBACK, "When this creature enters, choose one —\n• This creature gains haste until end of turn.\n• Destroy target artifact or enchantment.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "This creature gains haste until end of turn.", targets: vocabularyTargets("~ gains haste until end of turn.") },
  { text: "Destroy target artifact or enchantment.", targets: vocabularyTargets("Destroy target artifact or enchantment.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Destroy target artifact or enchantment.", RAVENOUS_SAILBACK.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Destroy target artifact or enchantment.");

export const RAVENOUS_SAILBACK_SCRIPT: CardScript = {
  oracleId: RAVENOUS_SAILBACK.oracleId,
  name: RAVENOUS_SAILBACK.name,
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
      label: () => "Ravenous Sailback - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["haste"] }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
