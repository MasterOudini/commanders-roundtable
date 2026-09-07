// `Elder Gargaroth` - a attacks trigger token, a blocks trigger token, a attacks trigger gainLife, a blocks trigger gainLife, a attacks trigger draw, a blocks trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELDER_GARGAROTH } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(ELDER_GARGAROTH, "Vigilance, reach, trample\nWhenever this creature attacks or blocks, choose one —\n• Create a 3/3 green Beast creature token.\n• You gain 3 life.\n• Draw a card.");
const LINES = PRINTED.split('\n');
const TOKEN_L1_m0 = tokenRef("Beast|3/3|G|Creature|");

const MODES_L1 = [
  { text: "Create a 3/3 green Beast creature token.", targets: vocabularyTargets("Create a 3/3 green Beast creature token.") },
  { text: "You gain 3 life.", targets: vocabularyTargets("You gain 3 life.") },
  { text: "Draw a card.", targets: vocabularyTargets("Draw a card.") },
];

export const ELDER_GARGAROTH_SCRIPT: CardScript = {
  oracleId: ELDER_GARGAROTH.oracleId,
  name: ELDER_GARGAROTH.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Elder Gargaroth - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return Array.from({ length: 1 }, () => ({
            t: 'TokenCreated' as const,
            card: ctx.ids.nextInstance(),
            oracleId: TOKEN_L1_m0.oracleId,
            printingId: TOKEN_L1_m0.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          }));
        }
        if (chosen === 1) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
        }
        if (chosen === 2) {
          return drawEvents(ctx.state, obj.controller, 1);
        }
        return [];
      },
    },
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Elder Gargaroth - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return Array.from({ length: 1 }, () => ({
            t: 'TokenCreated' as const,
            card: ctx.ids.nextInstance(),
            oracleId: TOKEN_L1_m0.oracleId,
            printingId: TOKEN_L1_m0.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          }));
        }
        if (chosen === 1) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
        }
        if (chosen === 2) {
          return drawEvents(ctx.state, obj.controller, 1);
        }
        return [];
      },
    },
  ],
};
