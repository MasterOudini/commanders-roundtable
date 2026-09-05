// `Shard of Broken Glass` - a static attachedStatic, a equippedCreatureAttacks trigger mill
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHARD_OF_BROKEN_GLASS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHARD_OF_BROKEN_GLASS, "Equipped creature gets +1/+0.\nWhenever equipped creature attacks, you may mill two cards.\nEquip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const SHARD_OF_BROKEN_GLASS_SCRIPT: CardScript = {
  oracleId: SHARD_OF_BROKEN_GLASS.oracleId,
  name: SHARD_OF_BROKEN_GLASS.name,
  triggers: [
    {
      abilityId: 'equippedCreatureAttacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === ctx.state.cards[self]?.attachedTo),
      label: () => "Shard of Broken Glass - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 2));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
