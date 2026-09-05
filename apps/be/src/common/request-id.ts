import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

export const REQUEST_ID_HEADER = "x-request-id";

/** Run before Nest's middleware so Pino receives the same server-generated ID. */
export function configureRequestIds(server: FastifyInstance): void {
  server.addHook("onRequest", (request, reply, done) => {
    const id = randomUUID();
    request.id = id;
    Object.assign(request.raw, { id });
    void reply.header(REQUEST_ID_HEADER, id);
    done();
  });
}
