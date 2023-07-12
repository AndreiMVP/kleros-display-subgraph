import { Address, Bytes } from "@graphprotocol/graph-ts";
import { Kleros as KlerosContract } from "../generated/Kleros/Kleros";

export const Kleros = KlerosContract.bind(
  Address.fromBytes(Bytes.fromHexString("{{address}}"))
);
