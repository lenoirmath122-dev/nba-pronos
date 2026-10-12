// Faux client Supabase enregistreur pour les tests (jamais importé hors tests).
// Chaque requête awaitée devient un `Call` ; le `handler` décide de la réponse.

export type Call = {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: [string, string, unknown][];
  cols?: string;
  head?: boolean;
  range?: [number, number];
  single?: boolean;
  upsertOptions?: unknown;
};

export type Reply = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

export function fakeClient(handler: (call: Call) => Reply) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {
        select(cols?: string, options?: { head?: boolean }) {
          if (call.op === "select") call.cols = cols;
          if (options?.head) call.head = true;
          return builder;
        },
        insert(payload: unknown) {
          call.op = "insert";
          call.payload = payload;
          return builder;
        },
        update(payload: unknown) {
          call.op = "update";
          call.payload = payload;
          return builder;
        },
        upsert(payload: unknown, options?: unknown) {
          call.op = "upsert";
          call.payload = payload;
          call.upsertOptions = options;
          return builder;
        },
        delete() {
          call.op = "delete";
          return builder;
        },
        range(from: number, to: number) {
          call.range = [from, to];
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle() {
          call.single = true;
          return builder;
        },
        single() {
          call.single = true;
          return builder;
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          calls.push(call);
          try {
            const reply = handler(call);
            let data = reply.data ?? null;
            if (call.single && Array.isArray(data)) data = data[0] ?? null;
            resolve({ data, error: reply.error ?? null, count: reply.count ?? null });
          } catch (error) {
            reject(error);
          }
        },
      };
      for (const name of ["eq", "neq", "in", "is", "lt", "lte", "gt", "gte", "not", "or"]) {
        builder[name] = (column: string, ...rest: unknown[]) => {
          call.filters.push([name, column, rest.length > 1 ? rest : rest[0]]);
          return builder;
        };
      }
      return builder;
    },
  };
  return { client: client as never, calls };
}

export const hasFilter = (call: Call, op: string, column: string, value?: unknown): boolean =>
  call.filters.some(
    ([o, c, v]) => o === op && c === column && (value === undefined || JSON.stringify(v) === JSON.stringify(value)),
  );
