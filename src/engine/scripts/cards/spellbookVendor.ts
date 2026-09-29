// `Spellbook Vendor` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPELLBOOK_VENDOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPELLBOOK_VENDOR, "Vigilance\nAt the beginning of combat on your turn, you may pay {1}. When you do, create a Sorcerer Role token attached to target creature you control. (If you control another Role on it, put that one into the graveyard. Enchanted creature gets +1/+1 and has \"Whenever this creature attacks, scry 1.\")");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {1}. When you do, create a Sorcerer Role token attached to target creature you control.", SPELLBOOK_VENDOR.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {1}. When you do, create a Sorcerer Role token attached to target creature you control.");

export const SPELLBOOK_VENDOR_SCRIPT: CardScript = {
  oracleId: SPELLBOOK_VENDOR.oracleId,
  name: SPELLBOOK_VENDOR.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Spellbook Vendor - You may pay {1}. When you do, create a Sorcerer Role token attached to target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
