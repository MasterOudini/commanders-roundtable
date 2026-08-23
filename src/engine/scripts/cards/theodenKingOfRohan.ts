// `Théoden, King of Rohan` — the self-or-HUMAN entry pair granting DOUBLE
// STRIKE on D194's carrier. Two defs, because a token entering is a
// `TokenCreated` and never a `CardsMoved` (Soul Warden's rule, D158) and the
// printed line carries no `nontoken` to exclude one.
//
// ⚠️ The fixture const strips the diacritic (D222's Lothlórien rule):
// TH_ODEN_KING_OF_ROHAN, not THÉODEN_…. D259.

import { TH_ODEN_KING_OF_ROHAN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  TH_ODEN_KING_OF_ROHAN,
  'Whenever Théoden or another Human you control enters, target creature gains double strike until end of turn.',
);

/** Théoden himself, or another Human of mine — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  if (entrant === self) return true;
  return ctx.derive(entrant).typeLine.subtypes.includes('Human');
}

function grant(
  ctx: ScriptCtx,
  obj: { targets: readonly { kind: string; id: string }[] },
): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  if (ctx.state.cards[target.id as InstanceId]?.zone.kind !== 'battlefield') return [];
  return [
    {
      t: 'PtModifiedUntilEndOfTurn' as const,
      card: target.id as InstanceId,
      power: 0,
      toughness: 0,
      keywords: ['doubleStrike'],
    },
  ];
}

export const THEODEN_KING_OF_ROHAN_SCRIPT: CardScript = {
  oracleId: TH_ODEN_KING_OF_ROHAN.oracleId,
  name: TH_ODEN_KING_OF_ROHAN.name,
  triggers: [
    {
      abilityId: 'human-etb-card',
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
      label: () => 'Théoden, King of Rohan — target creature gains double strike',
      resolve: (ctx, _self, obj): readonly EventBody[] => grant(ctx, obj),
    },
    {
      abilityId: 'human-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Théoden, King of Rohan — target creature gains double strike',
      resolve: (ctx, _self, obj): readonly EventBody[] => grant(ctx, obj),
    },
  ],
};
