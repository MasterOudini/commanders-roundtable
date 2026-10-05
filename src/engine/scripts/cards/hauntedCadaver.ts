// `Haunted Cadaver` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAUNTED_CADAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAUNTED_CADAVER, "Whenever this creature deals combat damage to a player, you may sacrifice it. If you do, that player discards three cards.\nMorph {1}{B} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may sacrifice it. If you do, target player discards three cards.", HAUNTED_CADAVER.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice it. If you do, target player discards three cards.");

export const HAUNTED_CADAVER_SCRIPT: CardScript = {
  oracleId: HAUNTED_CADAVER.oracleId,
  name: HAUNTED_CADAVER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, self, ev) => ((ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? (ev.damages.find((d) => d.source === self && d.target.kind === 'player' && d.amount > 0)?.target.id ?? null) : null),
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Haunted Cadaver - You may sacrifice it. If you do, target player discards three cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
