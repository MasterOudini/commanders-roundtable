// `Onulet` — `{3}` 2/2 Artifact Creature, "When this creature dies, you gain
// 2 life." The first DIES trigger to ship (M6.4a, D158) — the shape D147 built
// `looksBack` for, proved by `testing/cardScripts.ts`'s copy and shipped here.
//
// ⚠️ This file REPLACED the testing copy — one card, one script (the rule five
// DECISIONS entries exist to enforce). The engine tests that drove the testing
// copy import this one now.

import { ONULET } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const TEXT = printed(ONULET, 'When this creature dies, you gain 2 life.');

export const ONULET_SCRIPT: CardScript = {
  oracleId: ONULET.oracleId,
  name: ONULET.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      // ⚠️ CR 603.10a — a dies trigger fires off the board it DIED ON, so the
      // bus hands `matches` the BEFORE state and checks `activeZones` there.
      // With the flag off this card gains nobody anything, ever (D147).
      looksBack: true,
      // "dies" is CR 700.4 — battlefield to GRAVEYARD, and nowhere else. A
      // creature exiled or bounced does not die, which is why this reads both
      // ends of the move rather than just the destination.
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Onulet — gain 2 life',
      // ⚠️ `obj.controller` — captured when the trigger fired, i.e. who
      // controlled the creature AS IT DIED, which is who "you" means (CR
      // 603.3d) even for a stolen Onulet. The testing copy read the dead card's
      // OWNER, which is the same player only while nothing has changed hands;
      // its own comment argued for this field and then did not use it.
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
