// `Apothecary Stomper` - a etb trigger vocab, a etb trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APOTHECARY_STOMPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APOTHECARY_STOMPER, "Vigilance (Attacking doesn't cause this creature to tap.)\nWhen this creature enters, choose one —\n• Put two +1/+1 counters on target creature you control.\n• You gain 4 life.");
const LINES = PRINTED.split('\n');

const MODES_L1 = [
  { text: "Put two +1/+1 counters on target creature you control.", targets: vocabularyTargets("Put two +1/+1 counters on target creature you control.") },
  { text: "You gain 4 life.", targets: vocabularyTargets("You gain 4 life.") },
];

const VOCAB_L1_m0 = vocabularyEffects("Put two +1/+1 counters on target creature you control.", APOTHECARY_STOMPER.name);
const VOCAB_T_L1_m0 = vocabularyTargets("Put two +1/+1 counters on target creature you control.");

export const APOTHECARY_STOMPER_SCRIPT: CardScript = {
  oracleId: APOTHECARY_STOMPER.oracleId,
  name: APOTHECARY_STOMPER.name,
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
      label: () => "Apothecary Stomper - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L1_m0, VOCAB_T_L1_m0);
        }
        if (chosen === 1) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
        }
        return [];
      },
    },
  ],
};
