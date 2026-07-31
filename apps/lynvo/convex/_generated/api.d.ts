/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountCapacity from "../accountCapacity.js";
import type * as accountErasure from "../accountErasure.js";
import type * as accountLifecycle from "../accountLifecycle.js";
import type * as auth from "../auth.js";
import type * as authGateway from "../authGateway.js";
import type * as authPolicy from "../authPolicy.js";
import type * as authentication from "../authentication.js";
import type * as commands from "../commands.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as links from "../links.js";
import type * as migrations from "../migrations.js";
import type * as passwordCrypto from "../passwordCrypto.js";
import type * as pluginDomainLifecycle from "../pluginDomainLifecycle.js";
import type * as pluginDomains from "../pluginDomains.js";
import type * as storagePolicy from "../storagePolicy.js";
import type * as tv from "../tv.js";
import type * as usage from "../usage.js";
import type * as userPluginServers from "../userPluginServers.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountCapacity: typeof accountCapacity;
  accountErasure: typeof accountErasure;
  accountLifecycle: typeof accountLifecycle;
  auth: typeof auth;
  authGateway: typeof authGateway;
  authPolicy: typeof authPolicy;
  authentication: typeof authentication;
  commands: typeof commands;
  constants: typeof constants;
  crons: typeof crons;
  http: typeof http;
  links: typeof links;
  migrations: typeof migrations;
  passwordCrypto: typeof passwordCrypto;
  pluginDomainLifecycle: typeof pluginDomainLifecycle;
  pluginDomains: typeof pluginDomains;
  storagePolicy: typeof storagePolicy;
  tv: typeof tv;
  usage: typeof usage;
  userPluginServers: typeof userPluginServers;
  userPreferences: typeof userPreferences;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
