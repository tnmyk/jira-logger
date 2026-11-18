import { useState, type SyntheticEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { ApiClientError, errorMessage, validateConnection } from "@/lib/api-client";
import type { Connection } from "@/lib/types";
import { Button, Input } from "./ui";

export default function ConnectScreen({
  onConnect,
}: {
  onConnect: (connection: Connection) => void;
}) {
  const [baseUrl, setBaseUrl] = useState("https://");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let normalizedUrl = baseUrl.trim();
    if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    setPending(true);
    try {
      const profile = await validateConnection({
        baseUrl: normalizedUrl,
        email,
        token,
      });

      onConnect({
        baseUrl: profile.baseUrl,
        deployment: "cloud",
        email: email.trim(),
        token: token.trim(),
        accountId: profile.accountId,
        displayName: profile.displayName,
        timeZone:
          profile.timeZone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "UTC",
      });
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : errorMessage(caught),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-12 items-center px-5">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-sm bg-accent" />
          <span className="text-[12.5px] font-medium tracking-[-0.01em] text-text">
            Jira Logger
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[350px] -translate-y-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-faint">
            Local utility
          </p>
          <h1 className="mt-3 text-[20px] font-medium tracking-[-0.02em] text-text">
            Connect Jira
          </h1>
          <p className="mt-2 text-[12px] leading-5 text-text-muted">
            Your token stays in this browser. The local proxy uses it only to
            call Jira.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] text-text-muted">
                Jira site
              </span>
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://your-domain.atlassian.net"
                autoComplete="url"
                spellCheck={false}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] text-text-muted">
                Email
              </span>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[11px] text-text-muted">
                <span>API token</span>
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-text-faint transition-colors hover:text-text"
                >
                  Create one
                  <ArrowUpRight size={11} />
                </a>
              </span>
              <Input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste your Jira API token"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            {error ? (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[11.5px] leading-5 text-danger"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              className="mt-1 w-full"
              disabled={pending}
            >
              {pending ? "Connecting…" : "Connect"}
            </Button>
          </form>

          <p className="mt-6 text-[11px] leading-5 text-text-faint">
            Jira Cloud only. This app does not create an account or a login
            session.
          </p>
        </div>
      </main>
    </div>
  );
}
