export { DbStorage, IStorage } from "../storage";
export type { IdentityStorage } from "./contracts/identity";
export type { AgencyStorage } from "./contracts/agency";
export type { ExtractedStorage } from "./contracts";

import { DbStorage } from "../storage";

export const storage = new DbStorage();
