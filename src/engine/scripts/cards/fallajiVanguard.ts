// `Fallaji Vanguard` — "First strike\nWhenever this creature or another
// creature you control enters, target creature gets +2/+0 until end of
// turn." A SELF-INCLUSIVE controlled-creature entry watcher (Bogwater
// Lumaret's inclusion) that TARGETS — and one printed line is TWO defs
// because tokens enter via `TokenCreated` (Soul Warden's rule). M6.4r,
// D174.

import { FALLAJI_VANGUARD } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
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

const PRINTED = printed(
  FALLAJI_VANGUARD,
  'First strike\nWhenever this creature or another creature you control enters, target creature gets +2/+0 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

/** "this creature or another creature you control" — the entrant, derived. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.types.includes('Creature');
}

function pump(ctx: ScriptCtx, obj: { readonly targets: readonly { kind: string; id: string }[] }): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  const card = ctx.state.cards[target.id as InstanceId];
  if (!card || card.zone.kind !== 'battlefield') return [];
  return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id as InstanceId, power: 2, toughness: 0 }];
}

export const FALLAJI_VANGUARD_SCRIPT: CardScript = {
  oracleId: FALLAJI_VANGUARD.oracleId,
  name: FALLAJI_VANGUARD.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            qualifies(ctx, self, m.card),
        ),
      label: () => 'Fallaji Vanguard — target creature gets +2/+0',
      resolve: (ctx, _self, obj): readonly EventBody[] => pump(ctx, obj),
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Fallaji Vanguard — target creature gets +2/+0',
      resolve: (ctx, _self, obj): readonly EventBody[] => pump(ctx, obj),
    },
  ],
};
