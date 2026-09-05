// `Cephalid Aristocrat` - a becomesTargeted trigger mill
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CEPHALID_ARISTOCRAT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(CEPHALID_ARISTOCRAT, "Whenever this creature becomes the target of a spell or ability, mill two cards.");

export const CEPHALID_ARISTOCRAT_SCRIPT: CardScript = {
  oracleId: CEPHALID_ARISTOCRAT.oracleId,
  name: CEPHALID_ARISTOCRAT.name,
  triggers: [
    {
      abilityId: 'becomesTargeted-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Cephalid Aristocrat - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 2));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
    {
      abilityId: 'becomesTargetedAbility-0',
      text: PRINTED,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Cephalid Aristocrat - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 2));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
};
