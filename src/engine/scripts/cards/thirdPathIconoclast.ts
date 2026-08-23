// `Third Path Iconoclast` — the noncreature cast watcher (Student of Ojutai's
// filter, D254) paying a Soldier. The token is the 1/1 colorless Soldier
// ARTIFACT creature already pinned as `SOLDIER_ARTIFACT_TOKEN` (totc 26,
// D167) — verified against TOKEN_TABLE before this was written, so nothing
// new is pinned. D259.

import { THIRD_PATH_ICONOCLAST } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const TEXT = printed(
  THIRD_PATH_ICONOCLAST,
  'Whenever you cast a noncreature spell, create a 1/1 colorless Soldier artifact creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SOLDIER = tokenRef('Soldier|1/1||Artifact Creature|');

export const THIRD_PATH_ICONOCLAST_SCRIPT: CardScript = {
  oracleId: THIRD_PATH_ICONOCLAST.oracleId,
  name: THIRD_PATH_ICONOCLAST.name,
  triggers: [
    {
      abilityId: 'noncreature-cast',
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
        const face = oc.faces[inst?.faceIndex ?? 0];
        if (!face) return false;
        return !face.typeLine.types.includes('Creature');
      },
      label: () => 'Third Path Iconoclast — create a 1/1 Soldier',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SOLDIER.oracleId,
          printingId: SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
