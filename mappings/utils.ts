import { BigInt, Bytes } from "@graphprotocol/graph-ts";

export const ZERO_B = Bytes.fromI32(0);
export const ZERO = BigInt.fromI32(0);
export const ONE = BigInt.fromI32(1);

export function biToBytes(bi: BigInt): Bytes {
  return bi.isZero() ? ZERO_B : Bytes.fromByteArray(Bytes.fromBigInt(bi));
}

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
