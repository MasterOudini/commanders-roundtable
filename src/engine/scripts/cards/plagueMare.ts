// `Plague Mare` - a static cantBeBlockedBy, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PLAGUE_MARE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PLAGUE_MARE, "This creature can't be blocked by white creatures.\nWhen this creature enters, creatures your opponents control get -1/-1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Creatures your opponents control get -1/-1 until end of turn.", PLAGUE_MARE.name);
const VOCAB_T_L1 = vocabularyTargets("Creatures your opponents control get -1/-1 until end of turn.");

export const PLAGUE_MARE_SCRIPT: CardScript = {
  oracleId: PLAGUE_MARE.oracleId,
  name: PLAGUE_MARE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Plague Mare - Creatures your opponents control get -1/-1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlockedBy-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Creature') && ctx.derive(blocker).colors.includes('W')),
    },
  ],
};
