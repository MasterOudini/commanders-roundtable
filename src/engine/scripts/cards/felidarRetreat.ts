// `Felidar Retreat` - a landfall trigger token, a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FELIDAR_RETREAT } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(FELIDAR_RETREAT, "Landfall — Whenever a land you control enters, choose one —\n• Create a 2/2 white Cat Beast creature token.\n• Put a +1/+1 counter on each creature you control. Those creatures gain vigilance until end of turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m0 = tokenRef("Cat Beast|2/2|W|Creature|");

const MODES_L0 = [
  { text: "Create a 2/2 white Cat Beast creature token.", targets: vocabularyTargets("Create a 2/2 white Cat Beast creature token.") },
  { text: "Put a +1/+1 counter on each creature you control. Those creatures gain vigilance until end of turn.", targets: vocabularyTargets("Put a +1/+1 counter on each creature you control. Those creatures gain vigilance until end of turn.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Put a +1/+1 counter on each creature you control. Those creatures gain vigilance until end of turn.", FELIDAR_RETREAT.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Put a +1/+1 counter on each creature you control. Those creatures gain vigilance until end of turn.");

export const FELIDAR_RETREAT_SCRIPT: CardScript = {
  oracleId: FELIDAR_RETREAT.oracleId,
  name: FELIDAR_RETREAT.name,
  triggers: [
    {
      abilityId: 'landfall-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Felidar Retreat - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return Array.from({ length: 1 }, () => ({
            t: 'TokenCreated' as const,
            card: ctx.ids.nextInstance(),
            oracleId: TOKEN_L0_m0.oracleId,
            printingId: TOKEN_L0_m0.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          }));
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        return [];
      },
    },
  ],
};
