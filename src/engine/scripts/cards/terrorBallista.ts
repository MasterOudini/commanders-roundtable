// `Terror Ballista` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TERROR_BALLISTA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TERROR_BALLISTA, "Menace\nWhenever this creature attacks, you may sacrifice another creature. When you do, destroy target creature an opponent controls.\nUnearth {3}{B}{B} ({3}{B}{B}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may sacrifice another creature. When you do, destroy target creature an opponent controls.", TERROR_BALLISTA.name);
const VOCAB_T_L1 = vocabularyTargets("You may sacrifice another creature. When you do, destroy target creature an opponent controls.");

export const TERROR_BALLISTA_SCRIPT: CardScript = {
  oracleId: TERROR_BALLISTA.oracleId,
  name: TERROR_BALLISTA.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Terror Ballista - You may sacrifice another creature. When you do, destroy target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
