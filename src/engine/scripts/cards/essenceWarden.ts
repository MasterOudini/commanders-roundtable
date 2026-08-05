// `Essence Warden` — `{G}` 1/1, "Whenever another creature enters, you gain
// 1 life." — Soul Warden's green twin, word for word, so the script is the
// same shape and the reasoning lives there (M6.4a, D158).

import { ESSENCE_WARDEN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ESSENCE_WARDEN, 'Whenever another creature enters, you gain 1 life.');

function gainOne(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
  const player = ctx.state.players[obj.controller];
  if (!player) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
}

/** Two defs for one line — see `soulWarden.ts` for why (tokens are not moves). */
export const ESSENCE_WARDEN_SCRIPT: CardScript = {
  oracleId: ESSENCE_WARDEN.oracleId,
  name: ESSENCE_WARDEN.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.card !== self &&
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => 'Essence Warden — gain 1 life',
      resolve: gainOne,
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'TokenCreated' &&
        ev.card !== self &&
        ctx.derive(ev.card).typeLine.types.includes('Creature'),
      label: () => 'Essence Warden — gain 1 life',
      resolve: gainOne,
    },
  ],
};
