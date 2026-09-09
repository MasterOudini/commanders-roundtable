// `Vaevictis Asmadi` - a upkeep trigger vocab, an activation pumping itself, an activation pumping itself, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VAEVICTIS_ASMADI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VAEVICTIS_ASMADI, "Flying\nAt the beginning of your upkeep, sacrifice Vaevictis Asmadi unless you pay {B}{R}{G}.\n{B}: Vaevictis Asmadi gets +1/+0 until end of turn.\n{R}: Vaevictis Asmadi gets +1/+0 until end of turn.\n{G}: Vaevictis Asmadi gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Sacrifice ~ unless you pay {B}{R}{G}.", VAEVICTIS_ASMADI.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice ~ unless you pay {B}{R}{G}.");

export const VAEVICTIS_ASMADI_SCRIPT: CardScript = {
  oracleId: VAEVICTIS_ASMADI.oracleId,
  name: VAEVICTIS_ASMADI.name,
  activated: [
    {
      ref: `${VAEVICTIS_ASMADI.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
    {
      ref: `${VAEVICTIS_ASMADI.oracleId}#a1`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
    {
      ref: `${VAEVICTIS_ASMADI.oracleId}#a2`,
      text: LINES[4] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
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
      label: () => "Vaevictis Asmadi - Sacrifice ~ unless you pay {B}{R}{G}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
