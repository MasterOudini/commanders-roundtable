// `Boltwing Marauder` — "Flying\nWhenever another creature you control
// enters, target creature gets +2/+0 until end of turn." Soul Warden's two
// entry defs, scoped to the controller and EXCLUDING self, each targeting
// through D147's machinery and writing the layer-7c pump. M6.4h, D165.

import { BOLTWING_MARAUDER } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(
  BOLTWING_MARAUDER,
  'Flying\nWhenever another creature you control enters, target creature gets +2/+0 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function pump(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  const card = ctx.state.cards[target.id];
  if (!card || card.zone.kind !== 'battlefield') return [];
  return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 }];
}

export const BOLTWING_MARAUDER_SCRIPT: CardScript = {
  oracleId: BOLTWING_MARAUDER.oracleId,
  name: BOLTWING_MARAUDER.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.card === self) return false;
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          const card = ctx.state.cards[m.card];
          if (!card || card.controller !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        });
      },
      label: () => 'Boltwing Marauder — target creature gets +2/+0 until end of turn',
      resolve: pump,
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'TokenCreated' &&
        ev.card !== self &&
        ev.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.card).typeLine.types.includes('Creature'),
      label: () => 'Boltwing Marauder — target creature gets +2/+0 until end of turn',
      resolve: pump,
    },
  ],
};
