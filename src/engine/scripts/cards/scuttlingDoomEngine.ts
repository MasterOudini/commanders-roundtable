// `Scuttling Doom Engine` - a static cantBeBlockedByPower, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCUTTLING_DOOM_ENGINE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCUTTLING_DOOM_ENGINE, "This creature can't be blocked by creatures with power 2 or less.\nWhen this creature dies, it deals 6 damage to target opponent or planeswalker.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 6 damage to target opponent or planeswalker.", SCUTTLING_DOOM_ENGINE.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 6 damage to target opponent or planeswalker.");

export const SCUTTLING_DOOM_ENGINE_SCRIPT: CardScript = {
  oracleId: SCUTTLING_DOOM_ENGINE.oracleId,
  name: SCUTTLING_DOOM_ENGINE.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Scuttling Doom Engine - ~ deals 6 damage to target opponent or planeswalker.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
