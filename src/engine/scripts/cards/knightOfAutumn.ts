// `Knight of Autumn` - a etb trigger selfCounter, a etb trigger vocab, a etb trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNIGHT_OF_AUTUMN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNIGHT_OF_AUTUMN, "When this creature enters, choose one —\n• Put two +1/+1 counters on this creature.\n• Destroy target artifact or enchantment.\n• You gain 4 life.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Put two +1/+1 counters on this creature.", targets: vocabularyTargets("Put two +1/+1 counters on ~.") },
  { text: "Destroy target artifact or enchantment.", targets: vocabularyTargets("Destroy target artifact or enchantment.") },
  { text: "You gain 4 life.", targets: vocabularyTargets("You gain 4 life.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Destroy target artifact or enchantment.", KNIGHT_OF_AUTUMN.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Destroy target artifact or enchantment.");

export const KNIGHT_OF_AUTUMN_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_AUTUMN.oracleId,
  name: KNIGHT_OF_AUTUMN.name,
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
      label: () => "Knight of Autumn - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        if (chosen === 2) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
        }
        return [];
      },
    },
  ],
};
