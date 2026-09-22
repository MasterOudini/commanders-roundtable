// `Inspired Inventor` - a etb trigger vocab, a etb trigger counterOnTarget, a etb trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INSPIRED_INVENTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INSPIRED_INVENTOR, "When this creature enters, choose one —\n• You get {E}{E}{E} (three energy counters).\n• Put a +1/+1 counter on target creature.\n• Create a 1/1 colorless Servo artifact creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L0_m2 = tokenRef("Servo|1/1||Artifact Creature|");

const MODES_L0 = [
  { text: "You get {E}{E}{E}                        .", targets: vocabularyTargets("You get {E}{E}{E}.") },
  { text: "Put a +1/+1 counter on target creature.", targets: vocabularyTargets("Put a +1/+1 counter on target creature.") },
  { text: "Create a 1/1 colorless Servo artifact creature token.", targets: vocabularyTargets("Create a 1/1 colorless Servo artifact creature token.") },
];

const VOCAB_L0_m0 = vocabularyEffects("You get {E}{E}{E}.", INSPIRED_INVENTOR.name);
const VOCAB_T_L0_m0 = vocabularyTargets("You get {E}{E}{E}.");

export const INSPIRED_INVENTOR_SCRIPT: CardScript = {
  oracleId: INSPIRED_INVENTOR.oracleId,
  name: INSPIRED_INVENTOR.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Inspired Inventor - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L0_m0, VOCAB_T_L0_m0);
        }
        if (chosen === 1) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
        }
        if (chosen === 2) {
          return Array.from({ length: 1 }, () => ({
            t: 'TokenCreated' as const,
            card: ctx.ids.nextInstance(),
            oracleId: TOKEN_L0_m2.oracleId,
            printingId: TOKEN_L0_m2.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          }));
        }
        return [];
      },
    },
  ],
};
