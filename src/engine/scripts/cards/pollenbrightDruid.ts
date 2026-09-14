// `Pollenbright Druid` - a etb trigger counterOnTarget, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { POLLENBRIGHT_DRUID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(POLLENBRIGHT_DRUID, "When this creature enters, choose one —\n• Put a +1/+1 counter on target creature.\n• Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Put a +1/+1 counter on target creature.", targets: vocabularyTargets("Put a +1/+1 counter on target creature.") },
  { text: "Proliferate.", targets: vocabularyTargets("Proliferate.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Proliferate.", POLLENBRIGHT_DRUID.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Proliferate.");

export const POLLENBRIGHT_DRUID_SCRIPT: CardScript = {
  oracleId: POLLENBRIGHT_DRUID.oracleId,
  name: POLLENBRIGHT_DRUID.name,
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
      label: () => "Pollenbright Druid - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
