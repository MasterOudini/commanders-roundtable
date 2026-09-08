// `Eternal of Harsh Truths` - a attacksNotBlocked trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ETERNAL_OF_HARSH_TRUTHS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(ETERNAL_OF_HARSH_TRUTHS, "Afflict 2 (Whenever this creature becomes blocked, defending player loses 2 life.)\nWhenever this creature attacks and isn't blocked, draw a card.");
const LINES = PRINTED.split('\n');

export const ETERNAL_OF_HARSH_TRUTHS_SCRIPT: CardScript = {
  oracleId: ETERNAL_OF_HARSH_TRUTHS.oracleId,
  name: ETERNAL_OF_HARSH_TRUTHS.name,
  triggers: [
    {
      abilityId: 'attacksNotBlocked-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' && (ctx.state.combat?.attackers.some((a) => a.card === self) ?? false) && !ev.blocks.some((b) => b.attacker === self),
      label: () => "Eternal of Harsh Truths - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
