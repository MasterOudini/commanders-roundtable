// `Nebelgast Herald` — "Whenever this creature or another Spirit you
// control enters, tap target creature an opponent controls." The
// self-inclusive Spirit entry pair (two defs, Soul Warden's token rule)
// with a targeted tap; the opponent restriction is enforced at the aim.
// The resolves are deliberately inline twice (the Haazda Vigilante
// lesson, D178). D228.

import { NEBELGAST_HERALD } from '../../../data/fixtures/engineCards';
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
  NEBELGAST_HERALD,
  'Flash\nFlying\nWhenever this creature or another Spirit you control enters, tap target creature an opponent controls.',
);
const TEXT = PRINTED.split('\n')[2] as string;

function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return true;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.subtypes.includes('Spirit');
}

export const NEBELGAST_HERALD_SCRIPT: CardScript = {
  oracleId: NEBELGAST_HERALD.oracleId,
  name: NEBELGAST_HERALD.name,
  triggers: [
    {
      abilityId: 'spirit-etb-card',
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
      label: () => 'Nebelgast Herald — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
    {
      abilityId: 'spirit-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Nebelgast Herald — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
