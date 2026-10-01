// `Noxious Hatchling` - a static entersWithCounters, a castSpell trigger vocab, a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NOXIOUS_HATCHLING } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(NOXIOUS_HATCHLING, "This creature enters with four -1/-1 counters on it.\nWither (This deals damage to creatures in the form of -1/-1 counters.)\nWhenever you cast a black spell, remove a -1/-1 counter from this creature.\nWhenever you cast a green spell, remove a -1/-1 counter from this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Remove a -1/-1 counter from this creature.", NOXIOUS_HATCHLING.name);
const VOCAB_T_L2 = vocabularyTargets("Remove a -1/-1 counter from this creature.");
const VOCAB_L3 = vocabularyEffects("Remove a -1/-1 counter from this creature.", NOXIOUS_HATCHLING.name);
const VOCAB_T_L3 = vocabularyTargets("Remove a -1/-1 counter from this creature.");

export const NOXIOUS_HATCHLING_SCRIPT: CardScript = {
  oracleId: NOXIOUS_HATCHLING.oracleId,
  name: NOXIOUS_HATCHLING.name,
  triggers: [
    {
      abilityId: 'castSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('B'),
      label: () => "Noxious Hatchling - Remove a -1/-1 counter from this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'castSpell-3',
      text: LINES[3] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('G'),
      label: () => "Noxious Hatchling - Remove a -1/-1 counter from this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "-1/-1", delta: 4 }] }],
    },
  ],
};
