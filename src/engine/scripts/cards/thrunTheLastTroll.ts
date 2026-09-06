// `Thrun, the Last Troll` - a static cantBeCountered, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THRUN_THE_LAST_TROLL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THRUN_THE_LAST_TROLL, "This spell can't be countered.\nHexproof (This creature can't be the target of spells or abilities your opponents control.)\n{1}{G}: Regenerate Thrun.");
const LINES = PRINTED.split('\n');

export const THRUN_THE_LAST_TROLL_SCRIPT: CardScript = {
  oracleId: THRUN_THE_LAST_TROLL.oracleId,
  name: THRUN_THE_LAST_TROLL.name,
  activated: [
    {
      ref: `${THRUN_THE_LAST_TROLL.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  cantBeCountered: { abilityId: 'cant-be-countered-0', text: LINES[0] as string },
};
