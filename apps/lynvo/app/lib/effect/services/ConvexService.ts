import { Context, Effect, Layer } from "effect"
import { ConvexHttpClient } from "convex/browser"
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server"
import { ConvexError } from "../errors"
import { CloudflareEnv } from "./CloudflareEnv"

export interface ConvexRequestOptions {
  readonly accessToken?: string
}

export interface ConvexServiceContract {
  readonly action: <Action extends FunctionReference<"action", "public">>(
    actionReference: Action,
    args: FunctionArgs<Action>,
    options?: ConvexRequestOptions
  ) => Effect.Effect<FunctionReturnType<Action>, ConvexError>
  readonly query: <Query extends FunctionReference<"query", "public">>(
    queryReference: Query,
    args: FunctionArgs<Query>,
    options?: ConvexRequestOptions
  ) => Effect.Effect<FunctionReturnType<Query>, ConvexError>
  readonly mutation: <Mutation extends FunctionReference<"mutation", "public">>(
    mutationReference: Mutation,
    args: FunctionArgs<Mutation>,
    options?: ConvexRequestOptions
  ) => Effect.Effect<FunctionReturnType<Mutation>, ConvexError>
}

const convexFailure =
  (operation: string) =>
  (cause: unknown): ConvexError =>
    new ConvexError({ message: `Convex ${operation} failed`, cause })

export class ConvexService extends Context.Service<
  ConvexService,
  ConvexServiceContract
>()("app/effect/services/ConvexService") {
  static readonly layer = Layer.effect(
    ConvexService,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv

      const makeClient = (accessToken?: string): ConvexHttpClient => {
        const client = new ConvexHttpClient(env.VITE_CONVEX_URL)
        if (accessToken) {
          client.setAuth(accessToken)
        }
        return client
      }

      const query: ConvexServiceContract["query"] = (
        queryReference,
        args,
        options
      ) =>
        Effect.tryPromise({
          try: () =>
            makeClient(options?.accessToken).query(queryReference, args),
          catch: convexFailure("query"),
        })

      const mutation: ConvexServiceContract["mutation"] = (
        mutationReference,
        args,
        options
      ) =>
        Effect.tryPromise({
          try: () =>
            makeClient(options?.accessToken).mutation(mutationReference, args),
          catch: convexFailure("mutation"),
        })

      const action: ConvexServiceContract["action"] = (
        actionReference,
        args,
        options
      ) =>
        Effect.tryPromise({
          try: () =>
            makeClient(options?.accessToken).action(actionReference, args),
          catch: convexFailure("action"),
        })

      return ConvexService.of({ action, query, mutation })
    })
  )
}
