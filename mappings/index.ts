import {
  AppealDecision as AppealDecisionEv,
  AppealPossible as AppealPossibleEv,
  DisputeCreation as DisputeCreationEv,
  NewPeriod as NewPeriodEv,
  Draw as DrawEv,
  Kleros,
} from "../generated/Kleros/Kleros";
import {
  MetaEvidence as MetaEvidenceEv,
  Dispute as DisputeEv,
  Evidence as EvidenceEv,
  Ruling as RulingEv,
} from "../generated/templates/Arbitrable/Arbitrable";
import { Arbitrable as ArbitrableContract } from "../generated/templates";
import {
  ArbitrableHistory,
  Dispute,
  Evidence,
  EvidenceGroup,
  Round,
} from "../generated/schema";
import { ADDRESS, ONE, ZERO, ZERO_B } from "./const";
import { BigInt, Bytes, crypto } from "@graphprotocol/graph-ts";

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

export function biToBytes(bi: BigInt): Bytes {
  return bi.isZero() ? ZERO_B : Bytes.fromByteArray(Bytes.fromBigInt(bi));
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
  dispute.nbRounds = ONE;
  dispute.nbChoices = Kleros.bind(ADDRESS)
    .disputes(ev.params._disputeID)
    .getNumberOfChoices();
  dispute.save();

  const round = new Round(
    Bytes.fromByteArray(
      crypto.keccak256(biToBytes(ev.params._disputeID).concat(ZERO_B))
    )
  );
  round.dispute = dispute.id;
  round.jurors = [];
  round.save();
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

  const round = new Round(
    Bytes.fromByteArray(
      crypto.keccak256(
        biToBytes(ev.params._disputeID).concat(biToBytes(dispute.nbRounds))
      )
    )
  );
  round.dispute = dispute.id;
  round.jurors = [];
  round.save();

  dispute.period = Period.EVIDENCE;
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.nbRounds = dispute.nbRounds.plus(ONE);
  dispute.save();
}

export function handleNewPeriod(ev: NewPeriodEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString());
  if (dispute == null) return;

  dispute.period = Period.parse(ev.params._period);
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.save();
}

export function handleDraw(ev: DrawEv): void {
  const round = Round.load(
    Bytes.fromByteArray(
      crypto.keccak256(
        biToBytes(ev.params._disputeID).concat(
          biToBytes(BigInt.fromI32(ev.params._appeal))
        )
      )
    )
  );
  if (round == null) return;

  round.jurors.push(ev.params._address);
  round.save();
}

export function handleMetaEvidence(ev: MetaEvidenceEv): void {
  const arbitrableHistory = new ArbitrableHistory(
    Bytes.fromByteArray(
      crypto.keccak256(ev.address.concat(biToBytes(ev.params._metaEvidenceID)))
    )
  );
  arbitrableHistory.metaEvidence = ev.params._evidence;
  arbitrableHistory.save();
}

export function handleDispute(ev: DisputeEv): void {
  const arbitrableHistory = ArbitrableHistory.load(
    Bytes.fromByteArray(
      crypto.keccak256(ev.address.concat(biToBytes(ev.params._metaEvidenceID)))
    )
  );

  const dispute = Dispute.load(ev.params._disputeID.toString());
  if (dispute == null) return;
  dispute.metaEvidenceId = ev.params._metaEvidenceID;
  if (arbitrableHistory != null)
    dispute.arbitrableHistory = arbitrableHistory.id;
  dispute.save();

  const evidenceGroupId = Bytes.fromByteArray(
    crypto.keccak256(ev.address.concat(biToBytes(ev.params._evidenceGroupID)))
  );
  let evidenceGroup = EvidenceGroup.load(evidenceGroupId);
  if (evidenceGroup == null) {
    evidenceGroup = new EvidenceGroup(evidenceGroupId);
    evidenceGroup.length = ZERO;
  }
  evidenceGroup.dispute = dispute.id;
  evidenceGroup.save();
}

export function handleEvidence(ev: EvidenceEv): void {
  const evidenceGroupId = Bytes.fromByteArray(
    crypto.keccak256(ev.address.concat(biToBytes(ev.params._evidenceGroupID)))
  );
  let evidenceGroup = EvidenceGroup.load(evidenceGroupId);
  if (evidenceGroup == null) {
    evidenceGroup = new EvidenceGroup(evidenceGroupId);
    evidenceGroup.length = ZERO;
  }
  evidenceGroup.length = evidenceGroup.length.plus(ONE);
  evidenceGroup.save();

  const evidence = new Evidence(
    Bytes.fromByteArray(
      crypto.keccak256(evidenceGroupId.concat(biToBytes(evidenceGroup.length)))
    )
  );
  evidence.URI = ev.params._evidence;
  evidence.group = evidenceGroup.id;
  evidence.creationTime = ev.block.timestamp;
  evidence.sender = ev.params._party;
  evidence.save();
}

export function handleRuling(ev: RulingEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString());
  if (dispute == null) return;
  dispute.ruling = ev.params._ruling;
  dispute.ruled = true;
  dispute.save();
}
