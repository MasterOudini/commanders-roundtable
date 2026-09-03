// `Prosperous Partnership` — two green-white Citizens on entry; tapping
// three untapped creatures I control (the D286 tap chooser) makes a
// Treasure.

import { PROSPEROUS_PARTNERSHIP } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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
  PROSPEROUS_PARTNERSHIP,
  'When this enchantment enters, create two 1/1 green and white Citizen creature tokens.\nTap three untapped creatures you control: Create a Treasure token.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const TREASURE_LINE = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const CITIZEN = tokenRef('Citizen|1/1|GW|Creature|');
const TREASURE = tokenRef('Treasure|/||Artifact|');

function token(ctx: ScriptCtx, controller: string, ref: TokenRef): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: ref.oracleId,
    printingId: ref.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

export const PROSPEROUS_PARTNERSHIP_SCRIPT: CardScript = {
  oracleId: PROSPEROUS_PARTNERSHIP.oracleId,
  name: PROSPEROUS_PARTNERSHIP.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Prosperous Partnership — create two Citizens',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        token(ctx, obj.controller, CITIZEN),
        token(ctx, obj.controller, CITIZEN),
      ],
    },
  ],
  activated: [
    {
      ref: `${PROSPEROUS_PARTNERSHIP.oracleId}#a0`,
      text: TREASURE_LINE,
      resolve: (ctx, _self, obj): readonly EventBody[] => [token(ctx, obj.controller, TREASURE)],
    },
  ],
};
