// `Cosmogrand Zenith` - a secondSpell trigger token, a secondSpell trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COSMOGRAND_ZENITH } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
import type { CardScript } from '../api';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(COSMOGRAND_ZENITH, "Whenever you cast your second spell each turn, choose one —\n• Create two 1/1 white Human Soldier creature tokens.\n• Put a +1/+1 counter on each creature you control.");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m0 = tokenRef("Human Soldier|1/1|W|Creature|");

const MODES_L0 = [
  { text: "Create two 1/1 white Human Soldier creature tokens.", targets: vocabularyTargets("Create two 1/1 white Human Soldier creature tokens.") },
  { text: "Put a +1/+1 counter on each creature you control.", targets: vocabularyTargets("Put a +1/+1 counter on each creature you control.") },
];

export const COSMOGRAND_ZENITH_SCRIPT: CardScript = {
  oracleId: COSMOGRAND_ZENITH.oracleId,
  name: COSMOGRAND_ZENITH.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Cosmogrand Zenith - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return Array.from({ length: 2 }, () => ({
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
          const changes: { card: InstanceId; kind: string; delta: number }[] = [];
          for (const inst of Object.values(ctx.state.cards)) {
            if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
            if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
            changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
          }
          return changes.length ? [{ t: 'CountersChanged', changes }] : [];
        }
        return [];
      },
    },
  ],
};
