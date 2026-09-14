// `Skull Collector` - a upkeep trigger vocab, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKULL_COLLECTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKULL_COLLECTOR, "At the beginning of your upkeep, return a black creature you control to its owner's hand.\n{1}{B}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return a black creature you control to its owner's hand.", SKULL_COLLECTOR.name);
const VOCAB_T_L0 = vocabularyTargets("Return a black creature you control to its owner's hand.");

export const SKULL_COLLECTOR_SCRIPT: CardScript = {
  oracleId: SKULL_COLLECTOR.oracleId,
  name: SKULL_COLLECTOR.name,
  activated: [
    {
      ref: `${SKULL_COLLECTOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Skull Collector - Return a black creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
