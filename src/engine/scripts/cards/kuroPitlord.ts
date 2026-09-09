// `Kuro, Pitlord` - a upkeep trigger vocab, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KURO_PITLORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KURO_PITLORD, "At the beginning of your upkeep, sacrifice Kuro unless you pay {B}{B}{B}{B}.\nPay 1 life: Target creature gets -1/-1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Sacrifice ~ unless you pay {B}{B}{B}{B}.", KURO_PITLORD.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice ~ unless you pay {B}{B}{B}{B}.");

export const KURO_PITLORD_SCRIPT: CardScript = {
  oracleId: KURO_PITLORD.oracleId,
  name: KURO_PITLORD.name,
  activated: [
    {
      ref: `${KURO_PITLORD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
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
      label: () => "Kuro, Pitlord - Sacrifice ~ unless you pay {B}{B}{B}{B}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
