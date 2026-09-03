// `Benthic Djinn` - selfLife on "you lose 2 life": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { BENTHIC_DJINN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(BENTHIC_DJINN, "Islandwalk (This creature can't be blocked as long as defending player controls an Island.)\nAt the beginning of your upkeep, you lose 2 life.");
const TEXT = PRINTED.split('\n')[1] as string;

export const BENTHIC_DJINN_SCRIPT: CardScript = {
  oracleId: BENTHIC_DJINN.oracleId,
  name: BENTHIC_DJINN.name,
  triggers: [
    {
      abilityId: 'upkeep',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Benthic Djinn - you lose 2 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -2, to: me.life + (-2) }];
      },
    },
  ],
};
