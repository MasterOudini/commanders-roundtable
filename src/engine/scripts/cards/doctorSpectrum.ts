// `Doctor Spectrum` - a etb trigger token, a etb trigger massCounter, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOCTOR_SPECTRUM } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(DOCTOR_SPECTRUM, "Flying\nWhen Doctor Spectrum enters, choose one —\n• Create a 0/4 colorless Wall creature token with defender.\n• Put a +1/+1 counter on each other Hero you control.\n• Destroy target enchantment.");
const LINES = PRINTED.split('\n');
const TOKEN_L1_m0 = tokenRef("Wall|0/4||Creature|defender");

const MODES_L1 = [
  { text: "Create a 0/4 colorless Wall creature token with defender.", targets: vocabularyTargets("Create a 0/4 colorless Wall creature token with defender.") },
  { text: "Put a +1/+1 counter on each other Hero you control.", targets: vocabularyTargets("Put a +1/+1 counter on each other Hero you control.") },
  { text: "Destroy target enchantment.", targets: vocabularyTargets("Destroy target enchantment.") },
];

const VOCAB_L1_m2 = vocabularyEffects("Destroy target enchantment.", DOCTOR_SPECTRUM.name);
const VOCAB_T_L1_m2 = vocabularyTargets("Destroy target enchantment.");

export const DOCTOR_SPECTRUM_SCRIPT: CardScript = {
  oracleId: DOCTOR_SPECTRUM.oracleId,
  name: DOCTOR_SPECTRUM.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Doctor Spectrum - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
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
          const changes: { card: InstanceId; kind: string; delta: number }[] = [];
          for (const inst of Object.values(ctx.state.cards)) {
            if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
            if (inst.id === self) continue;
            if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
            if (!ctx.derive(inst.id).typeLine.subtypes.includes("Hero")) continue;
            changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
          }
          return changes.length ? [{ t: 'CountersChanged', changes }] : [];
        }
        if (chosen === 2) {
          return ctx.vocabulary(obj, VOCAB_L1_m2, VOCAB_T_L1_m2);
        }
        return [];
      },
    },
  ],
};
