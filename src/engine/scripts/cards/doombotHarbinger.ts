// `Doombot Harbinger` - a etb trigger mill, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOOMBOT_HARBINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOOMBOT_HARBINGER, "Flying\nWhen this creature enters, you may mill four cards. (You may put the top four cards of your library into your graveyard.)\nWhen this creature dies, you may exile this card. When you do, return target creature card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You may exile this card. When you do, return target creature card from your graveyard to your hand.", DOOMBOT_HARBINGER.name);
const VOCAB_T_L2 = vocabularyTargets("You may exile this card. When you do, return target creature card from your graveyard to your hand.");

export const DOOMBOT_HARBINGER_SCRIPT: CardScript = {
  oracleId: DOOMBOT_HARBINGER.oracleId,
  name: DOOMBOT_HARBINGER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Doombot Harbinger - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 4));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
    {
      abilityId: 'dies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Doombot Harbinger - You may exile this card. When you do, return target creature card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
