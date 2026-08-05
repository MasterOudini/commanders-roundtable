// `Brandywine Farmer` — "When this creature enters or leaves the
// battlefield, create a Food token." One line, two defs — and the leaves half
// is BROADER than a dies trigger: ANY departure (graveyard, exile, hand,
// library) pays, so its match reads only `from` and looks back (CR 603.10a).
// M6.4h, D165.

import { BRANDYWINE_FARMER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { StackObject } from '../../types/state';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(
  BRANDYWINE_FARMER,
  'When this creature enters or leaves the battlefield, create a Food token. ' +
    '(It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FOOD = tokenRef('Food|/||Artifact|');

function makeFood(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
  return [
    {
      t: 'TokenCreated',
      card: ctx.ids.nextInstance(),
      oracleId: FOOD.oracleId,
      printingId: FOOD.printingId,
      controller: obj.controller,
      owner: obj.controller,
      turnNumber: ctx.state.turn.turnNumber,
    },
  ];
}

export const BRANDYWINE_FARMER_SCRIPT: CardScript = {
  oracleId: BRANDYWINE_FARMER.oracleId,
  name: BRANDYWINE_FARMER.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Brandywine Farmer — create a Food token',
      resolve: makeFood,
    },
    {
      abilityId: 'leaves',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield',
        ),
      label: () => 'Brandywine Farmer — create a Food token',
      resolve: makeFood,
    },
  ],
};
