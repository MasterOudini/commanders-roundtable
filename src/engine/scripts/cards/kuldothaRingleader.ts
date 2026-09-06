// `Kuldotha Ringleader` - a attacks trigger battleCry, a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KULDOTHA_RINGLEADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KULDOTHA_RINGLEADER, "Battle cry (Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.)\nThis creature attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const KULDOTHA_RINGLEADER_SCRIPT: CardScript = {
  oracleId: KULDOTHA_RINGLEADER.oracleId,
  name: KULDOTHA_RINGLEADER.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Kuldotha Ringleader - battleCry",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Battle cry (CR 702.92): each other attacking creature gets +1/+0 until end of turn.
        return (ctx.state.combat?.attackers ?? []).filter((a) => a.card !== self).map((a) => ({ t: 'PtModifiedUntilEndOfTurn', card: a.card, power: 1, toughness: 0 }));
      },
    },
  ],
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
