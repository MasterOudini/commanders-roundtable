// `Thopter Architect` — the artifact-entry watcher granting flying, in TWO
// defs (Contraband Kingpin's shape, D204): a card entering is a `CardsMoved`
// and a token entering is a `TokenCreated`, and the printed line carries no
// `nontoken` to exclude either. The grant rides D194's carrier. D259.

import { THOPTER_ARCHITECT } from '../../../data/fixtures/engineCards';
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
  THOPTER_ARCHITECT,
  'Whenever an artifact you control enters, target creature gains flying until end of turn.',
);

/** "an artifact you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.types.includes('Artifact');
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
      keywords: ['flying'],
    },
  ];
}

export const THOPTER_ARCHITECT_SCRIPT: CardScript = {
  oracleId: THOPTER_ARCHITECT.oracleId,
  name: THOPTER_ARCHITECT.name,
  triggers: [
    {
      abilityId: 'artifact-etb-card',
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
      label: () => 'Thopter Architect — target creature gains flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => grant(ctx, obj),
    },
    {
      abilityId: 'artifact-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Thopter Architect — target creature gains flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => grant(ctx, obj),
    },
  ],
};
