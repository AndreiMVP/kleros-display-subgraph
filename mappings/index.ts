import {
  AppealDecision as AppealDecisionEv,
  AppealPossible as AppealPossibleEv,
  DisputeCreation as DisputeCreationEv,
  NewPeriod as NewPeriodEv,
  Draw as DrawEv,
  StakeSet as StakeSetEv,
  TokenAndETHShift as TokenAndETHShiftEv,
} from "../generated/Kleros/Kleros";
import {
  MetaEvidence as MetaEvidenceEv,
  Dispute as DisputeEv,
  Evidence as EvidenceEv,
  Ruling as RulingEv,
} from "../generated/templates/Arbitrable/Arbitrable";
import { Arbitrable as ArbitrableContract } from "../generated/templates";
import {
  Activity,
  Arbitrable,
  ArbitrableHistory,
  Choice,
  Dispute,
  Evidence,
  EvidenceGroup,
  Juror,
  Penalty,
  Reward,
  Round,
  Stake,
  Subcourt,
  Vote,
} from "../generated/schema";
import { ONE, Period, ZERO, biToBytes } from "./utils";
import { Bytes, crypto, store } from "@graphprotocol/graph-ts";
import { Kleros } from "./hardcoded";

export function handleDisputeCreation(ev: DisputeCreationEv): void {
  let arbitrable = Arbitrable.load(ev.params._arbitrable);
  if (arbitrable == null) {
    ArbitrableContract.create(ev.params._arbitrable);

    arbitrable = new Arbitrable(ev.params._arbitrable);
    arbitrable.firstInteractionBlock = ev.block.number;
    arbitrable.firstInteractionTimestamp = ev.block.timestamp;
    arbitrable.nbDisputes = ZERO;
  }
  arbitrable.nbDisputes = arbitrable.nbDisputes.plus(ONE);
  arbitrable.save();

  const dispute = new Dispute(ev.params._disputeID.toString());
  dispute.arbitrated = ev.params._arbitrable;
  dispute.metaEvidenceId = ZERO;
  dispute.ruling = ZERO;
  dispute.ruled = false;
  dispute.period = Period.EVIDENCE;
  dispute.createdAtBlock = ev.block.number;
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.nbRounds = ONE;
  dispute.nbChoices = Kleros.disputes(
    ev.params._disputeID
  ).getNumberOfChoices();
  dispute.save();

  const round = new Round(ev.params._disputeID.toString() + "#0");
  round.dispute = dispute.id;
  round.index = ZERO;
  round.votesCastedCount = ZERO;
  round.drawnCount = ZERO;
  round.subcourt = Kleros.disputes(ev.params._disputeID)
    .getSubcourtID()
    .toString();
  round.save();
}

export function handleAppealPossible(ev: AppealPossibleEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString()) as Dispute;
  const round = Round.load(
    dispute.id + "#" + dispute.nbRounds.minus(ONE).toString()
  ) as Round;
  const votes = round.votes.load();
  for (let i = 0; i < votes.length; i++) {
    const vote = votes[i];
    const voteData = Kleros.getVote(
      ev.params._disputeID,
      round.index,
      vote.index
    );
    vote.casted = voteData.getVoted();

    const choiceId = round.id + "#" + voteData.getChoice().toString();
    let choice = Choice.load(choiceId);
    if (choice == null) {
      choice = new Choice(choiceId);
      choice.round = round.id;
      choice.index = voteData.getChoice();
      choice.voteCount = ZERO;
    }
    choice.voteCount = choice.voteCount.plus(ONE);
    choice.save();

    vote.choice = choiceId;
    vote.save();

    round.votesCastedCount = round.votesCastedCount.plus(ONE);
  }
  round.save();

  dispute.ongoing.load().forEach(function(activity) {
    store.remove("Activity", activity.id);
  });
}

export function handleAppealDecision(ev: AppealDecisionEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString()) as Dispute;

  const round = new Round(
    ev.params._disputeID.toString() + "#" + dispute.nbRounds.toString()
  );
  round.index = dispute.nbRounds;
  round.dispute = dispute.id;
  round.votesCastedCount = ZERO;
  round.drawnCount = ZERO;
  round.subcourt = Kleros.disputes(ev.params._disputeID)
    .getSubcourtID()
    .toString();
  round.save();

  dispute.period = Period.EVIDENCE;
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.nbRounds = dispute.nbRounds.plus(ONE);
  dispute.save();
}

export function handleNewPeriod(ev: NewPeriodEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString()) as Dispute;
  dispute.period = Period.parse(ev.params._period);
  dispute.lastPeriodChange = ev.block.timestamp;
  dispute.save();
}

export function handleDraw(ev: DrawEv): void {
  const round = Round.load(
    ev.params._disputeID.toString() + "#" + ev.params._appeal.toString()
  ) as Round;
  round.drawnCount = round.drawnCount.plus(ONE);
  round.save();

  const juror = Juror.load(ev.params._address.toHex()) as Juror;
  juror.totalVotesDrawn = juror.totalVotesDrawn.plus(ONE);
  const ongoingActivities = juror.ongoing.load();
  let i = 0;
  while (i < ongoingActivities.length) {
    if (ongoingActivities[i++].dispute == ev.params._disputeID.toString())
      break;
  }
  if (i == ongoingActivities.length)
    juror.nbDisputesAttended = juror.nbDisputesAttended.plus(ONE);
  juror.save();

  const vote = new Vote(round.id + "#" + ev.params._voteID.toString());
  vote.round = round.id;
  vote.juror = ev.params._address.toHex();
  vote.casted = false;
  vote.index = ev.params._voteID;
  vote.save();

  const activityId = ev.params._address.toHex() + "#" + round.id;
  if (Activity.load(activityId) == null) {
    const activity = new Activity(activityId);
    activity.dispute = ev.params._disputeID.toString();
    activity.round = round.id;
    activity.juror = juror.id;
    activity.save();
  }
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

export function handleStakeSet(ev: StakeSetEv): void {
  let juror = Juror.load(ev.params._address.toHex());
  if (juror == null) {
    juror = new Juror(ev.params._address.toHex());
    juror.totalStaked = ZERO;
    juror.totalVotesDrawn = ZERO;
    juror.nbDisputesAttended = ZERO;
  }

  const stakeId =
    ev.params._address.toHex() + "#" + ev.params._subcourtID.toString();
  let stake = Stake.load(stakeId);
  if (stake == null) {
    let subcourt = Subcourt.load(ev.params._subcourtID.toString());
    if (subcourt == null) {
      subcourt = new Subcourt(ev.params._subcourtID.toString());
      subcourt.staked = ZERO;
    }
    subcourt.staked = subcourt.staked
      .minus(subcourt.staked)
      .plus(ev.params._newTotalStake);
    subcourt.save();

    stake = new Stake(stakeId);
    stake.subcourt = subcourt.id;
    stake.juror = juror.id;
  }

  juror.totalStaked = juror.totalStaked
    .minus(juror.totalStaked)
    .plus(ev.params._newTotalStake);
  juror.save();

  stake.amount = ev.params._newTotalStake;
  stake.save();
}

export function handleTokenAndETHShift(ev: TokenAndETHShiftEv): void {
  const dispute = Dispute.load(ev.params._disputeID.toString()) as Dispute;
  const shiftId = Bytes.fromByteArray(
    crypto.keccak256(ev.params._address.concat(biToBytes(ev.params._disputeID)))
  );
  if (ev.params._tokenAmount.gt(ZERO)) {
    let penalty = Penalty.load(shiftId);
    if (penalty == null) {
      penalty = new Penalty(shiftId);
      penalty.dispute = dispute.id;
      penalty.juror = ev.params._address.toHex();
      penalty.tokens = ZERO;
    }
    penalty.tokens = penalty.tokens.plus(ev.params._tokenAmount.abs());
    penalty.save();
  } else {
    let reward = Reward.load(shiftId);
    if (reward == null) {
      reward = new Reward(shiftId);
      reward.dispute = dispute.id;
      reward.juror = ev.params._address.toHex();
      reward.tokens = ZERO;
      reward.ETH = ZERO;
    }
    reward.tokens = reward.tokens.plus(ev.params._tokenAmount);
    reward.ETH = reward.ETH.plus(ev.params._ETHAmount);
    reward.save();
  }
}
