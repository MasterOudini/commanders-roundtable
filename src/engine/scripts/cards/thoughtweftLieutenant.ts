// `Thoughtweft Lieutenant` — the self-or-KITHKIN entry pair granting +1/+1
// AND trample in one carrier entry (D194 carries P/T and keywords together).
// Two defs, per Soul Warden's token rule (D158). D259.

import { THOUGHTWEFT_LIEUTENANT } from '../../../data/fixtures/engineCards';
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
  THOUGHTWEFT_LIEUTENANT,
  'Whenever this creature or another Kithkin you control enters, target creature you control gets +1/+1 and gains trample until end of turn.',
);

/** This Lieutenant, or another Kithkin of mine — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  if (entrant === self) return true;
  return ctx.derive(entrant).typeLine.subtypes.includes('Kithkin');
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
      power: 1,
      toughness: 1,
      keywords: ['trample'],
    },
  ];
}

export const THOUGHTWEFT_LIEUTENANT_SCRIPT: CardScript = {
  oracleId: THOUGHTWEFT_LIEUTENANT.oracleId,
  name: THOUGHTWEFT_LIEUTENANT.name,
  triggers: [
    {
      abilityId: 'kithkin-etb-card',
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
      label: () => 'Thoughtweft Lieutenant — +1/+1 and trample',
      resolve: (ctx, _self, obj): readonly EventBody[] => grant(ctx, obj),
    },
    {
      abilityId: 'kithkin-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Thoughtweft Lieutenant — +1/+1 and trample',
      resolve: (ctx, _self, obj): readonly EventBody[] => grant(ctx, obj),
    },
  ],
};
