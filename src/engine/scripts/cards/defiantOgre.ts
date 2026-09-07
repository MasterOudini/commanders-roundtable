// `Defiant Ogre` - a etb trigger selfCounter, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEFIANT_OGRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEFIANT_OGRE, "When this creature enters, choose one —\n• Put a +1/+1 counter on this creature.\n• Destroy target artifact.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Put a +1/+1 counter on this creature.", targets: vocabularyTargets("Put a +1/+1 counter on ~.") },
  { text: "Destroy target artifact.", targets: vocabularyTargets("Destroy target artifact.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Destroy target artifact.", DEFIANT_OGRE.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Destroy target artifact.");

export const DEFIANT_OGRE_SCRIPT: CardScript = {
  oracleId: DEFIANT_OGRE.oracleId,
  name: DEFIANT_OGRE.name,
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
      label: () => "Defiant Ogre - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
