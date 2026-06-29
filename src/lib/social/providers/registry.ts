/**
 * Connector registry — single lookup point keyed by connector id
 * (matches SocialAccount.connector). Multiple connectors can target the
 * same destination platform; adding a new one = drop a folder under
 * providers/<id>/ and add it here.
 */

import type { ConnectorId, SocialPlatform } from "../types";
import { linkedInProvider } from "./linkedin/provider";
import type { SocialProvider } from "./types";
import { zernioProvider } from "./zernio/provider";

const REGISTRY: Record<ConnectorId, SocialProvider> = {
  linkedin: linkedInProvider,
  zernio: zernioProvider,
};

export function getProvider(connectorId: ConnectorId): SocialProvider {
  const provider = REGISTRY[connectorId];
  if (!provider) throw new Error(`No provider registered for connector "${connectorId}"`);
  return provider;
}

export function listProviders(): SocialProvider[] {
  return Object.values(REGISTRY);
}

/** Connectors that can post to the given destination platform. */
export function getConnectorsForPlatform(platform: SocialPlatform): SocialProvider[] {
  return Object.values(REGISTRY).filter((p) => p.platforms.includes(platform));
}
