// `Javelin of Lightning` - a etb trigger attachTarget, a conditional static (as long as it's your turn) attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JAVELIN_OF_LIGHTNING } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardScript, ScriptCtx } from '../api';
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

const PRINTED = printed(JAVELIN_OF_LIGHTNING, "Flash\nWhen this Equipment enters, attach it to target creature you control.\nDuring your turn, equipped creature gets +2/+0 and has first strike.\nEquip {4} ({4}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

// "as long as it's your turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.activePlayer === me;
}


export const JAVELIN_OF_LIGHTNING_SCRIPT: CardScript = {
  oracleId: JAVELIN_OF_LIGHTNING.oracleId,
  name: JAVELIN_OF_LIGHTNING.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(LINES[1] as string),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Javelin of Lightning - attachTarget",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'AttachmentChanged', card: self, to: target.id }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate && cond2Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate && cond2Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
