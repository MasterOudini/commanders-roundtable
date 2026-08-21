// Staff of the Mind Magus - the blue/Island member of the five-Staff
// family (see staffOfTheDeathMagus.ts). D252.

import { STAFF_OF_THE_MIND_MAGUS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId, PlayerId } from '../../types/ids';
import { faceOf } from '../../oracle';

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
  STAFF_OF_THE_MIND_MAGUS,
  'Whenever you cast a blue spell or an Island you control enters, you gain 1 life.',
);

function landQualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.subtypes.includes('Island');
}

function gainOne(ctx: ScriptCtx, controller: PlayerId): readonly EventBody[] {
  const player = ctx.state.players[controller];
  if (!player || player.hasLost) return [];
  return [{ t: 'LifeChanged', player: controller, delta: 1, to: player.life + 1 }];
}

export const STAFF_OF_THE_MIND_MAGUS_SCRIPT: CardScript = {
  oracleId: STAFF_OF_THE_MIND_MAGUS.oracleId,
  name: STAFF_OF_THE_MIND_MAGUS.name,
  triggers: [
    {
      abilityId: 'cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).colors.includes('U');
      },
      label: () => 'Staff of the Mind Magus — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj.controller),
    },
    {
      abilityId: 'land-etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            landQualifies(ctx, self, m.card),
        ),
      label: () => 'Staff of the Mind Magus — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj.controller),
    },
    {
      abilityId: 'land-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && landQualifies(ctx, self, ev.card),
      label: () => 'Staff of the Mind Magus — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj.controller),
    },
  ],
};
