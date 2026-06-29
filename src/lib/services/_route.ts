/**
 * Route adapter helper: wraps a handler so any ServiceError thrown inside
 * is translated to the matching NextResponse JSON shape. Unknown errors
 * become 500.
 *
 * Usage:
 *   export const POST = withService(async (req) => {
 *     const user = await requireSessionUser()
 *     return NextResponse.json(await posts.create(user, await req.json()))
 *   })
 */
import { NextResponse } from "next/server";
import { isServiceError } from "./_errors";

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

export function withService<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (isServiceError(err)) {
        return NextResponse.json(
          { error: err.message, code: err.code, details: err.details },
          { status: err.status },
        );
      }
      console.error("[service] uncaught error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
