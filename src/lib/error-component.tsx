import type { ErrorComponentProps } from "@tanstack/react-router";

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#79d0f2] p-6 text-[#16323a]">
      <section className="w-full max-w-md rounded-3xl bg-[#fff6ea] p-6 text-center shadow-xl">
        <h1 className="font-display text-3xl">Oops! Something went wrong.</h1>
        <p className="mt-3 text-sm" role="alert">
          {error instanceof Error ? error.message : "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-full bg-[#16323a] px-6 py-3 font-semibold text-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
