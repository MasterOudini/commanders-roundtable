// `Nighthawk, Dark Defender` — "Whenever Nighthawk or another Hero you
// control enters, target creature gets +1/+1 until end of turn." The
// self-or-Hero entry pair, resolves inline twice (D178). D228.

import { NIGHTHAWK_DARK_DEFENDER } from '../../../data/fixtures/engineCards';
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
  NIGHTHAWK_DARK_DEFENDER,
  'Flying\nWhenever Nighthawk or another Hero you control enters, target creature gets +1/+1 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return true;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.subtypes.includes('Hero');
}

export const NIGHTHAWK_DARK_DEFENDER_SCRIPT: CardScript = {
  oracleId: NIGHTHAWK_DARK_DEFENDER.oracleId,
  name: NIGHTHAWK_DARK_DEFENDER.name,
  triggers: [
    {
      abilityId: 'hero-etb-card',
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
      label: () => 'Nighthawk, Dark Defender — +1/+1 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }]
          : [];
      },
    },
    {
      abilityId: 'hero-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Nighthawk, Dark Defender — +1/+1 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }]
          : [];
      },
    },
  ],
};
