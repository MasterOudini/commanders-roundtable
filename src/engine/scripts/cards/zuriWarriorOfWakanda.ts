// `Zuri, Warrior of Wakanda` - a castSpell trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZURI_WARRIOR_OF_WAKANDA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(ZURI_WARRIOR_OF_WAKANDA, "Trample\nWhenever you cast an artifact spell with mana value 4 or greater, put a +1/+1 counter on each creature you control.");
const LINES = PRINTED.split('\n');

export const ZURI_WARRIOR_OF_WAKANDA_SCRIPT: CardScript = {
  oracleId: ZURI_WARRIOR_OF_WAKANDA.oracleId,
  name: ZURI_WARRIOR_OF_WAKANDA.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Artifact') &&
        (ctx.derive(ev.obj.card).manaValue ?? 0) >= 4,
      label: () => "Zuri, Warrior of Wakanda - a counter on each creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
