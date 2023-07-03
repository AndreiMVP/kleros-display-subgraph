import {
  AppealDecision as AppealDecisionEv,
  AppealPossible as AppealPossibleEv,
  DisputeCreation as DisputeCreationEv,
  NewPeriod as NewPeriodEv,
} from "./generated/Kleros/Kleros";
import {
  MetaEvidence as MetaEvidenceEv,
  Dispute as DisputeEv,
  Evidence as EvidenceEv,
  Ruling as RulingEv,
} from "./generated/templates/Arbitrable/Arbitrable";
import { Arbitrable as ArbitrableContract } from "./generated/templates";
import { BigInt } from "@graphprotocol/graph-ts";
import {
  ArbitrableHistory,
  Dispute,
  Evidence,
  EvidenceGroup,
} from "./generated/schema";

const ZERO = BigInt.fromI32(0);
const ONE = BigInt.fromI32(1);

export class Period {
  static readonly EVIDENCE: string = "EVIDENCE";
  static readonly COMMIT: string = "COMMIT";
  static readonly VOTE: string = "VOTE";
  static readonly APPEAL: string = "APPEAL";
  static readonly EXECUTED: string = "EXECUTED";

  static parse(status: i32): string {
    switch (status) {
      case 0:
        return this.EVIDENCE;
      case 1:
        return this.COMMIT;
      case 2:
        return this.VOTE;
      case 3:
        return this.APPEAL;
      case 4:
        return this.EXECUTED;
      default:
        return "Error";
    }
  }
}

export function handleDisputeCreation(ev: DisputeCreationEv): void {
  ArbitrableContract.create(ev.params._arbitrable);

  const dispute = new Dispute(ev.params._disputeID.toString());
  dispute.arbitrated = ev.params._arbitrable;
  dispute.metaEvidenceId = ZERO;
  dispute.ruling = ZERO;
  dispute.ruled = false;
  dispute.period = Period.EVIDENCE;
  dispute.createdAtBlock = ev.block.number;
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.save();
}

export function handleAppealPossible(ev: AppealPossibleEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString());
  if (dispute == null) return;
  dispute.period = Period.APPEAL;
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.save();
}

export function handleAppealDecision(ev: AppealDecisionEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString());
  if (dispute == null) return;
  dispute.period = Period.EVIDENCE;
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.save();
}

export function handleNewPeriod(ev: NewPeriodEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString());
  if (dispute == null) return;
  dispute.period = Period.parse(ev.params._period);
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.save();
}

export function handleMetaEvidence(ev: MetaEvidenceEv): void {
  const arbitrableHistory = new ArbitrableHistory(
    ev.address.toHex() + "#" + ev.params._metaEvidenceID.toString()
  );
  arbitrableHistory.metaEvidence = ev.params._evidence;
  arbitrableHistory.save();
}

export function handleDispute(ev: DisputeEv): void {
  const arbitrableHistory = ArbitrableHistory.load(
    ev.address.toHex() + "#" + ev.params._metaEvidenceID.toString()
  );

  const dispute = Dispute.load(ev.params._disputeID.toString());
  if (dispute == null) return;
  dispute.metaEvidenceId = ev.params._metaEvidenceID;
  if (arbitrableHistory != null)
    dispute.arbitrableHistory = arbitrableHistory.id;
  dispute.save();

  const evidenceGroup = new EvidenceGroup(
    ev.address.toHex() + "#" + ev.params._evidenceGroupID.toHex()
  );
  evidenceGroup.dispute = dispute.id;
  evidenceGroup.length = ZERO;
  evidenceGroup.save();
}

export function handleEvidence(ev: EvidenceEv): void {
  const evidenceGroup = EvidenceGroup.load(
    ev.address.toHex() + "#" + ev.params._evidenceGroupID.toHex()
  );
  if (evidenceGroup == null) return;

  const evidence = new Evidence(
    evidenceGroup.id + "#" + evidenceGroup.length.toString()
  );
  evidence.URI = ev.params._evidence;
  evidence.group = evidenceGroup.id;
  evidence.creationTime = ev.block.timestamp;
  evidence.sender = ev.params._party;
  evidence.save();

  evidenceGroup.length = evidenceGroup.length.plus(ONE);
  evidenceGroup.save();
}

export function handleRuling(ev: RulingEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString());
  if (dispute == null) return;
  dispute.ruling = ev.params._ruling;
  dispute.ruled = true;
  dispute.save();
}
