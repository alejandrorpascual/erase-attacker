import { setInterval, setTimeout } from "timers/promises";
import { log as clackLog, confirm } from "@clack/prompts";
import { config } from "@utils/env.ts";
import { promptWrapper } from "@utils/prompt.ts";

type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type HTTPMethodLowercase = "get" | "post" | "put" | "delete" | "patch";

const controller = new AbortController();
const { signal } = controller;

export async function fetcher(
  pathname: string,
  {
    token,
    log = clackLog.warn,
    displayRetryingMsg = displayRetryingMessage,
    ...options
  }: {
    token: string;
    offset?: number;
    limit?: number;
    method?: HTTPMethodLowercase | HTTPMethod;
    body?: BodyInit;
    headers?: HeadersInit;
    displayRetryingMsg?: (
      retryAfter: string,
      log: (message: string) => void,
    ) => Promise<void>;
    log?(message: string): void;
  },
) {
  const url = new URL(pathname, config.spotify.baseApiUrl);
  if (options.offset) {
    url.searchParams.set("offset", String(options.offset));
  }
  if (options.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  const response = await fetch(url, {
    headers,
    method: options.method ?? "GET",
    body: options.body,
    signal,
  });

  if (response.status === 429) {
    log(`😒 Rate limited`);

    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      await displayRetryingMsg(retryAfter, log);

      return fetcher(pathname, {
        token,
        ...options,
      });
    }
  }

  return response;
}

async function displayRetryingMessage(
  retryAfter: string,
  log: (message: string) => void,
) {
  const seconds = Number(retryAfter);
  const ms = seconds * 1000;

  let stop = true;
  const { minutes } = getTime(ms / 1000);
  if (minutes > 1) {
    setTimeout(10000).then(() => {
      if (stop) {
        log("😒 Rate limited. Exiting...");
        process.exit(1);
      }
    });

    const isCancel = await promptWrapper(() =>
      confirm({
        message: "You are being rate limited. Do you want to wait?",
        active: "No",
        inactive: "Yes",
      }),
    );

    if (isCancel) {
      log("😒 Rate limited. Exiting...");
      process.exit(1);
    }

    stop = false;
  }

  await logCountdown({ ms, log, interval: 10 * 1000 });
}

function getTime(timeInSeconds: number) {
  const etaDate = new Date(timeInSeconds * 1000);
  const seconds = etaDate.getSeconds();
  const minutes = etaDate.getMinutes();
  const hours = etaDate.getHours();
  return { seconds, minutes, hours };
}

function getTimeCalculation({
  hours,
  minutes,
  seconds,
}: ReturnType<typeof getTime>) {
  let timeCalculation = "";
  if (hours > 1) {
    timeCalculation = `⏳ ETA: ${hours} hours ${minutes} min ${seconds} sec`;
  } else if (minutes > 0) {
    timeCalculation = `⏳ ETA: ${minutes} min ${seconds} sec`;
  } else {
    timeCalculation = `⏳ ETA: ${seconds.toFixed(0)} seconds`;
  }
  return timeCalculation;
}

async function logCountdown({
  ms,
  interval = 1000,
  log,
}: {
  ms: number;
  interval?: number;
  log: (message: string) => void;
}) {
  let stop = false;
  setTimeout(ms).then(() => (stop = true));

  let remainingMs = ms;
  const time = getTime(ms / 1000);
  log(getTimeCalculation(time));

  for await (const _ of setInterval(interval)) {
    void _; // silly variable to avoid ESLint error
    remainingMs -= interval;
    const time = getTime(remainingMs / 1000);
    log(getTimeCalculation(time));
    if (stop) break;
  }
}
