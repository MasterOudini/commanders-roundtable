// `Child of Gaea` - a upkeep trigger vocab, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHILD_OF_GAEA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(CHILD_OF_GAEA, "Trample\nAt the beginning of your upkeep, sacrifice this creature unless you pay {G}{G}.\n{1}{G}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Sacrifice this creature unless you pay {G}{G}.", CHILD_OF_GAEA.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice this creature unless you pay {G}{G}.");

export const CHILD_OF_GAEA_SCRIPT: CardScript = {
  oracleId: CHILD_OF_GAEA.oracleId,
  name: CHILD_OF_GAEA.name,
  activated: [
    {
      ref: `${CHILD_OF_GAEA.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Child of Gaea - Sacrifice this creature unless you pay {G}{G}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
