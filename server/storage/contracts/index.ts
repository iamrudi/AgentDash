export type { IdentityStorage } from "./identity";
export type { AgencyStorage } from "./agency";

import type { IdentityStorage } from "./identity";
import type { AgencyStorage } from "./agency";

export type ExtractedStorage = IdentityStorage & AgencyStorage;
