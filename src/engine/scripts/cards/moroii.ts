// `Moroii` - selfLife on "you lose 1 life": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { MOROII } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOROII, "Flying\nAt the beginning of your upkeep, you lose 1 life.");
const TEXT = PRINTED.split('\n')[1] as string;

export const MOROII_SCRIPT: CardScript = {
  oracleId: MOROII.oracleId,
  name: MOROII.name,
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
      label: () => "Moroii - you lose 1 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life + (-1) }];
      },
    },
  ],
};
