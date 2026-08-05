// `Soul Warden` — `{W}` 1/1, "Whenever another creature enters, you gain 1 life."
//
// The first card of M6.4a's first shipped batch (D158), from the user's own
// decks (§7 rung 1), and the shape that forced the two-def rule below.

import { SOUL_WARDEN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { StackObject } from '../../types/state';
import type { InstanceId } from '../../types/ids';

/**
 * The exact printed text this script claims to run, checked at import (D90 —
 * the same guard `testing/cardScripts.ts` carries, copied per module because a
 * shipped card may not import from `engine/testing/`).
 */
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

const TEXT = printed(SOUL_WARDEN, 'Whenever another creature enters, you gain 1 life.');

/**
 * ⚠️ `obj.controller`, NEVER a live lookup: the ability's controller was
 * captured when the trigger fired (CR 603.3d), and it is who "you" means even
 * if the Warden has changed hands or left the battlefield by resolution.
 */
function gainOne(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
  const player = ctx.state.players[obj.controller];
  if (!player) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
}

/**
 * ⚠️ TWO DEFS, ONE PRINTED LINE, AND BOTH ARE THE CARD. A card enters the
 * battlefield as a `CardsMoved`; a token NEVER does — `reducer.ts` builds a
 * token directly on the battlefield from `TokenCreated`, and the trigger bus
 * dispatches on exact event kind. One def watching `CardsMoved` alone is a Soul
 * Warden that ignores every token, which is half the creatures that enter a
 * real Commander game. Distinct `abilityId`s because `${oracleId}#${abilityId}`
 * must be unique (and neither may match /^a\d+$/ — that namespace belongs to
 * the parsed activated abilities).
 *
 * ⚠️ GRANULARITY, measured before shipping: every battlefield entry today
 * arrives in its OWN event — `ManualMoveZone` cannot target the battlefield,
 * effect moves are singular, and mass token creation is one `TokenCreated` per
 * token — so one firing per event IS one firing per creature. A future event
 * that batched several battlefield entries into one `CardsMoved` would
 * under-fire this trigger (one gain for N creatures); the bus would need
 * per-move firing before such an event is added.
 */
export const SOUL_WARDEN_SCRIPT: CardScript = {
  oracleId: SOUL_WARDEN.oracleId,
  name: SOUL_WARDEN.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      // "another" is the self check; "creature" is asked of `derive`, never the
      // printed type line, so an animated land or a Humility'd board answer
      // correctly (Yotian Dissident's precedent). `from !== battlefield` keeps a
      // battlefield-to-battlefield change of controller from reading as an entry.
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.card !== self &&
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => 'Soul Warden — gain 1 life',
      resolve: gainOne,
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      // A fresh token can never be its own source; the check is kept for
      // symmetry with the card def, where it is load-bearing.
      matches: (ctx, self, ev) =>
        ev.t === 'TokenCreated' &&
        ev.card !== self &&
        ctx.derive(ev.card).typeLine.types.includes('Creature'),
      label: () => 'Soul Warden — gain 1 life',
      resolve: gainOne,
    },
  ],
};
