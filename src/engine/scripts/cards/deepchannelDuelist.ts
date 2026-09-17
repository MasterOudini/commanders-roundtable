// `Deepchannel Duelist` - a endStep trigger vocab, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEEPCHANNEL_DUELIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEEPCHANNEL_DUELIST, "At the beginning of your end step, untap target Merfolk you control.\nOther Merfolk you control get +1/+1.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Untap target Merfolk you control.", DEEPCHANNEL_DUELIST.name);
const VOCAB_T_L0 = vocabularyTargets("Untap target Merfolk you control.");

export const DEEPCHANNEL_DUELIST_SCRIPT: CardScript = {
  oracleId: DEEPCHANNEL_DUELIST.oracleId,
  name: DEEPCHANNEL_DUELIST.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Deepchannel Duelist - Untap target Merfolk you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Merfolk") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
