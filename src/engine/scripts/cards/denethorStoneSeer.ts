// `Denethor, Stone Seer` - a etb trigger scry, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DENETHOR_STONE_SEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DENETHOR_STONE_SEER, "When Denethor enters, scry 2.\n{3}{R}, {T}, Sacrifice Denethor: Target player becomes the monarch. Denethor deals 3 damage to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player becomes the monarch. ~ deals 3 damage to any target.", DENETHOR_STONE_SEER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player becomes the monarch. ~ deals 3 damage to any target.");

export const DENETHOR_STONE_SEER_SCRIPT: CardScript = {
  oracleId: DENETHOR_STONE_SEER.oracleId,
  name: DENETHOR_STONE_SEER.name,
  activated: [
    {
      ref: `${DENETHOR_STONE_SEER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Denethor, Stone Seer - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Denethor, Stone Seer - scry 2" } },
        ];
      },
    },
  ],
};
