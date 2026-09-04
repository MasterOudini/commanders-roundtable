// `Web-Warriors` - a etb trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WEB_WARRIORS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WEB_WARRIORS, "When this creature enters, put a +1/+1 counter on each other creature you control.");

export const WEB_WARRIORS_SCRIPT: CardScript = {
  oracleId: WEB_WARRIORS.oracleId,
  name: WEB_WARRIORS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Web-Warriors - creatures you control pumped until end of turn",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (inst.id === self) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
