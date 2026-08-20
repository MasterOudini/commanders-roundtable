// `Mm'menon, Uthros Exile` — "Whenever an artifact you control enters, put
// a +1/+1 counter on target creature." Ivy Lane Denizen's targeted
// controlled-entry pair with the filter on ARTIFACTS — two defs (Soul
// Warden's token rule: a Treasure is an artifact entering), resolves
// inline twice per the Haazda Vigilante lesson (D178). D225.

import { MM_MENON_UTHROS_EXILE } from '../../../data/fixtures/engineCards';
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
  MM_MENON_UTHROS_EXILE,
  'Flying\nWhenever an artifact you control enters, put a +1/+1 counter on target creature.',
);
const TEXT = PRINTED.split('\n')[1] as string;

/** "an artifact you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.types.includes('Artifact');
}

export const MMMENON_UTHROS_EXILE_SCRIPT: CardScript = {
  oracleId: MM_MENON_UTHROS_EXILE.oracleId,
  name: MM_MENON_UTHROS_EXILE.name,
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
      label: () => "Mm'menon, Uthros Exile — put a +1/+1 counter on target creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
    {
      abilityId: 'artifact-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => "Mm'menon, Uthros Exile — put a +1/+1 counter on target creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
