// `Bartered Cow` — "When this creature dies and when you discard this card,
// create a Food token." ONE printed line, TWO zone-changes: the dies half is
// Beskir's shape, and the discard half is the FIRST def watching from the
// HAND — `activeZones: ['hand']` with `looksBack`, because by the time the
// bus runs a discarded card is in the graveyard (CR 603.10a's mechanism, one
// zone over). M6.4g, D164.

import { BARTERED_COW } from '../../../data/fixtures/engineCards';
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
  BARTERED_COW,
  'When this creature dies and when you discard this card, create a Food token. ' +
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

export const BARTERED_COW_SCRIPT: CardScript = {
  oracleId: BARTERED_COW.oracleId,
  name: BARTERED_COW.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Bartered Cow — create a Food token',
      resolve: makeFood,
    },
    {
      abilityId: 'discarded',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['hand'],
      optional: false,
      looksBack: true,
      // A discard is a hand→graveyard move of this card — the rules discard
      // (D137), the cleanup discard and the Tier-3 tool all take that path.
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'hand' && m.to.kind === 'graveyard',
        ),
      label: () => 'Bartered Cow — create a Food token',
      resolve: makeFood,
    },
  ],
};
