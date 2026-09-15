// `Walker of the Grove` - a leavesBattlefield trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WALKER_OF_THE_GROVE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(WALKER_OF_THE_GROVE, "When this creature leaves the battlefield, create a 4/4 green Elemental creature token.\nEvoke {4}{G} (You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters.)");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Elemental|4/4|G|Creature|");

export const WALKER_OF_THE_GROVE_SCRIPT: CardScript = {
  oracleId: WALKER_OF_THE_GROVE.oracleId,
  name: WALKER_OF_THE_GROVE.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Walker of the Grove - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
