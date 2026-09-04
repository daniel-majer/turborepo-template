import { Button } from "@repo/ui/components/button";

// TODO(template): Replace this starter page with your product UI and content.
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <span className="border-border text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs tracking-widest uppercase">
          Turborepo
        </span>

        <h1 className="mt-8 text-5xl font-medium tracking-tight text-balance">
          Build once, share everywhere.
        </h1>

        <p className="text-muted-foreground mt-5 text-lg leading-relaxed text-pretty">
          A Next.js frontend and a NestJS backend in one repository, with shared
          UI, types and configuration.
        </p>

        <div className="mt-10 flex items-center gap-3">
          <Button size="lg">Get started</Button>
          <Button size="lg" variant="ghost">
            Documentation
          </Button>
        </div>
      </div>
    </main>
  );
}
