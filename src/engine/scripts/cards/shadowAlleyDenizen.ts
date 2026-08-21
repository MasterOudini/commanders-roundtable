// `Shadow Alley Denizen` — "Whenever another black creature you control
// enters, target creature gains intimidate until end of turn." The
// color-filtered entry pair riding the D194 carrier. D246.

import { SHADOW_ALLEY_DENIZEN } from '../../../data/fixtures/engineCards';
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
  SHADOW_ALLEY_DENIZEN,
  'Whenever another black creature you control enters, target creature gains intimidate until end of turn. ' +
    "(It can't be blocked except by artifact creatures and/or creatures that share a color with it.)",
);

function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return false;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  const d = ctx.derive(entrant);
  return d.typeLine.types.includes('Creature') && d.colors.includes('B');
}

function grant(ctx: ScriptCtx, obj: { targets: readonly { kind: string; id: string }[] }) {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  if (ctx.state.cards[target.id as InstanceId]?.zone.kind !== 'battlefield') return [];
  return [
    {
      t: 'PtModifiedUntilEndOfTurn' as const,
      card: target.id as InstanceId,
      power: 0,
      toughness: 0,
      keywords: ['intimidate' as const],
    },
  ];
}

export const SHADOW_ALLEY_DENIZEN_SCRIPT: CardScript = {
  oracleId: SHADOW_ALLEY_DENIZEN.oracleId,
  name: SHADOW_ALLEY_DENIZEN.name,
  triggers: [
    {
      abilityId: 'black-etb-card',
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
      label: () => 'Shadow Alley Denizen — target creature gains intimidate',
      resolve: (ctx, _self, obj): readonly EventBody[] => grant(ctx, obj),
    },
    {
      abilityId: 'black-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Shadow Alley Denizen — target creature gains intimidate',
      resolve: (ctx, _self, obj): readonly EventBody[] => grant(ctx, obj),
    },
  ],
};
