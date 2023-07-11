import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

export const ADDRESS = Address.fromBytes(Bytes.fromHexString("{{address}}"));

export const ZERO_B = Bytes.fromI32(0);
export const ZERO = BigInt.fromI32(0);
export const ONE = BigInt.fromI32(1);
