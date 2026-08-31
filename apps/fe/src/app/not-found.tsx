import { Button } from "@repo/ui/components/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <span className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
          404
        </span>
        <h1 className="mt-6 text-3xl font-medium tracking-tight text-balance">
          This page does not exist.
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed text-pretty">
          The link may be outdated, or the page may have moved.
        </p>
        <Button render={<Link href="/" />} size="lg" className="mt-8">
          Back to home
        </Button>
      </div>
    </main>
  );
}
