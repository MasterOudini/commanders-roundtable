// `Harrier Griffin` — "At the beginning of your upkeep, tap target
// creature." The first UPKEEP trigger that TARGETS: Celestial Force's
// `StepBegan` with Eidolon of Inspiration's active-player filter ("your"
// upkeep), and Chrome Prowler's tap resolve on the answer. M6.4w, D179.

import { HARRIER_GRIFFIN } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(
  HARRIER_GRIFFIN,
  'Flying\nAt the beginning of your upkeep, tap target creature.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const HARRIER_GRIFFIN_SCRIPT: CardScript = {
  oracleId: HARRIER_GRIFFIN.oracleId,
  name: HARRIER_GRIFFIN.name,
  triggers: [
    {
      abilityId: 'upkeep',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'upkeep' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Harrier Griffin — tap target creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
