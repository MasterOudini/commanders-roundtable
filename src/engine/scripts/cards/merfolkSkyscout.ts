// `Merfolk Skyscout` — "Flying\nWhenever this creature attacks or blocks,
// untap target permanent." The FIRST attacks-or-blocks pair that TARGETS:
// Jedit's two arms each carrying Harrier Griffin's prompt, resolving as
// Filigree Sages's untap. M6.4ad, D186.

import { MERFOLK_SKYSCOUT } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';
import type { StackObject } from '../../types/state';

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

const PRINTED = printed(
  MERFOLK_SKYSCOUT,
  'Flying\nWhenever this creature attacks or blocks, untap target permanent.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function untapTarget(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  const card = ctx.state.cards[target.id];
  if (!card || card.zone.kind !== 'battlefield' || !card.tapped) return [];
  return [{ t: 'PermanentsUntapped', cards: [target.id] }];
}

export const MERFOLK_SKYSCOUT_SCRIPT: CardScript = {
  oracleId: MERFOLK_SKYSCOUT.oracleId,
  name: MERFOLK_SKYSCOUT.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Merfolk Skyscout — untap target permanent',
      resolve: untapTarget,
    },
    {
      abilityId: 'blocks',
      text: TEXT,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => 'Merfolk Skyscout — untap target permanent',
      resolve: untapTarget,
    },
  ],
};
