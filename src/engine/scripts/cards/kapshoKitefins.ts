// `Kapsho Kitefins` — "Whenever this creature or another creature you
// control enters, tap target creature an opponent controls." The
// self-inclusive controlled-entry watcher (the printed line spells the self
// arm out) asking for an aim — two defs (Soul Warden's token rule), both
// targeted, with Heavy Infantry's tap resolve. The resolves are inline
// twice (the Haazda Vigilante lesson, D178). M6.4aa, D183.

import { KAPSHO_KITEFINS } from '../../../data/fixtures/engineCards';
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
  KAPSHO_KITEFINS,
  'Flying\nWhenever this creature or another creature you control enters, tap target creature an opponent controls.',
);
const TEXT = PRINTED.split('\n')[1] as string;

/** "this creature or another creature you control" — self-INCLUSIVE. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return true;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.types.includes('Creature');
}

export const KAPSHO_KITEFINS_SCRIPT: CardScript = {
  oracleId: KAPSHO_KITEFINS.oracleId,
  name: KAPSHO_KITEFINS.name,
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
      label: () => 'Kapsho Kitefins — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Kapsho Kitefins — tap target creature an opponent controls',
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
