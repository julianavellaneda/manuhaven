// Preloaded by `bun run db:seed`: lets a script import modules guarded by
// "server-only" (a script is server code) without the react-server export
// condition, which would also swap React for its server build.

// Bun's own types are not installed; this is the one call used.
declare const Bun: {
  plugin(options: {
    name: string;
    setup(build: {
      module(
        specifier: string,
        load: () => { exports: Record<string, unknown>; loader: "object" },
      ): void;
    }): void;
  }): void;
};

Bun.plugin({
  name: "server-only",
  setup(build) {
    build.module("server-only", () => ({ exports: {}, loader: "object" }));
  },
});
