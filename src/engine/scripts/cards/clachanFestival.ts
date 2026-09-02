// `Clachan Festival` — "When this enchantment enters, create two 1/1 green
// and white Kithkin creature tokens.\n{4}{W}: Create a 1/1 green and white
// Kithkin creature token." A Kindred Enchantment that makes Kithkin on entry
// (two of them, two TokenCreated events) and one more per activation. The
// token is the pool's G/W Kithkin (tecl 7), pinned this batch. D273.

import { CLACHAN_FESTIVAL } from '../../../data/fixtures/engineCards';
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
  CLACHAN_FESTIVAL,
  'When this enchantment enters, create two 1/1 green and white Kithkin creature tokens.\n{4}{W}: Create a 1/1 green and white Kithkin creature token.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const MAKE_ONE = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const KITHKIN = tokenRef('Kithkin|1/1|GW|Creature|');

function kithkin(ctx: ScriptCtx, controller: string): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: KITHKIN.oracleId,
    printingId: KITHKIN.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

export const CLACHAN_FESTIVAL_SCRIPT: CardScript = {
  oracleId: CLACHAN_FESTIVAL.oracleId,
  name: CLACHAN_FESTIVAL.name,
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
      label: () => 'Clachan Festival — create two 1/1 Kithkin',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        kithkin(ctx, obj.controller),
        kithkin(ctx, obj.controller),
      ],
    },
  ],
  activated: [
    {
      ref: `${CLACHAN_FESTIVAL.oracleId}#a0`,
      text: MAKE_ONE,
      resolve: (ctx, _self, obj): readonly EventBody[] => [kithkin(ctx, obj.controller)],
    },
  ],
};
