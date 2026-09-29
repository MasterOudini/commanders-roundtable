// `Smoke Bomb` - a static anthem, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SMOKE_BOMB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SMOKE_BOMB, "Flash\nAll creatures have shroud. (They can't be the targets of spells or abilities.)\nAt the beginning of your upkeep, sacrifice this artifact. When you do, target creature you control can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Sacrifice this artifact. When you do, target creature you control can't be blocked this turn.", SMOKE_BOMB.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice this artifact. When you do, target creature you control can't be blocked this turn.");

export const SMOKE_BOMB_SCRIPT: CardScript = {
  oracleId: SMOKE_BOMB.oracleId,
  name: SMOKE_BOMB.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Smoke Bomb - Sacrifice this artifact. When you do, target creature you control can't be blocked this turn.",
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
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes("Creature"),
      modify: (chars) => {
        chars.keywords.add("shroud");
      },
    },
  ],
};
