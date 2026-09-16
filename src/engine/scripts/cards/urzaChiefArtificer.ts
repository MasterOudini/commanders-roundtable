// `Urza, Chief Artificer` - a static anthem, a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { URZA_CHIEF_ARTIFICER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(URZA_CHIEF_ARTIFICER, "Affinity for artifact creatures (This spell costs {1} less to cast for each artifact creature you control.)\nArtifact creatures you control have menace.\nAt the beginning of your end step, create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"", URZA_CHIEF_ARTIFICER.name);
const VOCAB_T_L2 = vocabularyTargets("Create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"");

export const URZA_CHIEF_ARTIFICER_SCRIPT: CardScript = {
  oracleId: URZA_CHIEF_ARTIFICER.oracleId,
  name: URZA_CHIEF_ARTIFICER.name,
  triggers: [
    {
      abilityId: 'endStep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Urza, Chief Artificer - Create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes("Artifact") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};
