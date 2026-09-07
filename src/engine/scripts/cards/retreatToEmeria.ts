// `Retreat to Emeria` - a landfall trigger token, a landfall trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RETREAT_TO_EMERIA } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const PRINTED = printed(RETREAT_TO_EMERIA, "Landfall — Whenever a land you control enters, choose one —\n• Create a 1/1 white Kor Ally creature token.\n• Creatures you control get +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m0 = tokenRef("Kor Ally|1/1|W|Creature|");

const MODES_L0 = [
  { text: "Create a 1/1 white Kor Ally creature token.", targets: vocabularyTargets("Create a 1/1 white Kor Ally creature token.") },
  { text: "Creatures you control get +1/+1 until end of turn.", targets: vocabularyTargets("Creatures you control get +1/+1 until end of turn.") },
];

export const RETREAT_TO_EMERIA_SCRIPT: CardScript = {
  oracleId: RETREAT_TO_EMERIA.oracleId,
  name: RETREAT_TO_EMERIA.name,
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
      label: () => "Retreat to Emeria - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
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
          const out: EventBody[] = [];
          for (const inst of Object.values(ctx.state.cards)) {
            if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
            if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
            out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1 });
          }
          return out;
        }
        return [];
      },
    },
  ],
};
