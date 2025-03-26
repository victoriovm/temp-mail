export interface Email {
    username: string
    email: string
}

export interface TempMailOptions {
    baseUrl?: string
    pollingIntervalMs?: number
    fetch?: typeof globalThis.fetch
}

export interface WaitOptions {
    signal?: AbortSignal
    pollingIntervalMs?: number
}

type MessageSummary = {
    id: string
}

type MessageContent = {
    html?: string
    text?: string
}

type StoredMessage = {
    content: MessageContent
}

const DEFAULT_POLLING_INTERVAL_MS = 3_000
const USERNAME_RANDOM_BYTES = 20

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function environmentBaseUrl() {
    const environment = (
        globalThis as typeof globalThis & {
            process?: { env?: Record<string, string | undefined> }
        }
    ).process?.env

    return environment?.TEMPMAIL_BASE_URL || environment?.TEMP_MAIL_BASE_URL
}

function normalizeBaseUrl(value: string | undefined) {
    const configuredValue = value?.trim() || environmentBaseUrl()?.trim()

    if (!configuredValue) {
        throw new TempMailError(
            "Provide baseUrl or set TEMPMAIL_BASE_URL/TEMP_MAIL_BASE_URL.",
        )
    }

    let url: URL

    try {
        url = new URL(configuredValue)
    } catch {
        throw new TempMailError(`Invalid baseUrl: ${configuredValue}`)
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new TempMailError("baseUrl must use the http or https protocol.")
    }

    if (url.search || url.hash) {
        throw new TempMailError("baseUrl must not contain a query string or fragment.")
    }

    return url.toString().replace(/\/$/, "")
}

function validatePollingInterval(value: number | undefined) {
    const interval = value ?? DEFAULT_POLLING_INTERVAL_MS

    if (!Number.isFinite(interval) || interval < 0) {
        throw new TempMailError(
            "pollingIntervalMs must be a number greater than or equal to zero.",
        )
    }

    return interval
}

function randomIndex(max: number) {
    const cryptoApi = globalThis.crypto

    if (cryptoApi?.getRandomValues) {
        const values = new Uint32Array(1)
        cryptoApi.getRandomValues(values)
        return (values[0] ?? 0) % max
    }

    return Math.floor(Math.random() * max)
}

function createUsername() {
    const cryptoApi = globalThis.crypto

    if (!cryptoApi?.getRandomValues) {
        throw new TempMailError(
            "This runtime does not provide a cryptographically secure random number generator.",
        )
    }

    const bytes = new Uint8Array(USERNAME_RANDOM_BYTES)
    cryptoApi.getRandomValues(bytes)
    const randomId = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("")

    return `tm-${randomId}`
}

function emailAddress(value: Email | string) {
    const address = (typeof value === "string" ? value : value?.email)
        ?.trim()
        .toLowerCase()

    if (
        !address ||
        !/^[a-z0-9][a-z0-9._-]{1,63}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(
            address,
        ) ||
        !address.slice(address.indexOf("@") + 1).includes(".")
    ) {
        throw new TempMailError("Invalid email address.")
    }

    return address
}

function mailboxKey(address: string) {
    return address.slice(0, address.indexOf("@"))
}

function abortReason(signal: AbortSignal) {
    return signal.reason ?? new DOMException("The wait was canceled.", "AbortError")
}

function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) throw abortReason(signal)
}

function delay(milliseconds: number, signal?: AbortSignal) {
    throwIfAborted(signal)

    return new Promise<void>((resolve, reject) => {
        const timeout = globalThis.setTimeout(finish, milliseconds)

        function finish() {
            signal?.removeEventListener("abort", cancel)
            resolve()
        }

        function cancel() {
            globalThis.clearTimeout(timeout)
            reject(abortReason(signal as AbortSignal))
        }

        signal?.addEventListener("abort", cancel, { once: true })
    })
}

function messageBodies(message: StoredMessage) {
    const bodies = [message.content.text, message.content.html].filter(
        (body): body is string =>
            typeof body === "string" && body.trim().length > 0,
    )

    return [...new Set(bodies)]
}

function regexMatch(regex: RegExp, body: string) {
    regex.lastIndex = 0
    const match = regex.exec(body)
    regex.lastIndex = 0
    return match?.[0]
}

function errorMessage(body: unknown, fallback: string) {
    return isRecord(body) && typeof body.error === "string"
        ? body.error
        : fallback
}

export class TempMailError extends Error {
    constructor(
        message: string,
        readonly status?: number,
        options?: ErrorOptions,
    ) {
        super(message, options)
        this.name = "TempMailError"
    }
}

export class TempMail {
    readonly baseUrl: string

    private readonly fetcher: typeof globalThis.fetch
    private readonly pollingIntervalMs: number
    private readonly consumedMessages = new Map<string, Set<string>>()

    constructor(options: TempMailOptions = {}) {
        this.baseUrl = normalizeBaseUrl(options.baseUrl)
        this.pollingIntervalMs = validatePollingInterval(options.pollingIntervalMs)

        const fetcher = options.fetch ?? globalThis.fetch
        if (typeof fetcher !== "function") {
            throw new TempMailError(
                "This runtime does not provide fetch. Pass an implementation in options.fetch.",
            )
        }

        this.fetcher = fetcher
    }

    async random(): Promise<Email> {
        const response = await this.request("/api/domains")

        if (
            !isRecord(response) ||
            !Array.isArray(response.domains) ||
            response.domains.length === 0
        ) {
            throw new TempMailError("The API did not return any valid domains.")
        }

        const domains = response.domains.filter(
            (domain): domain is string =>
                typeof domain === "string" &&
                /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) &&
                domain.includes("."),
        )

        if (domains.length === 0) {
            throw new TempMailError("The API did not return any valid domains.")
        }

        const username = createUsername()
        const domain = domains[randomIndex(domains.length)] as string

        return { username, email: `${username}@${domain}` }
    }

    async waitForMail(
        email: Email | string,
        options: WaitOptions = {},
    ): Promise<string> {
        return this.wait(email, undefined, options)
    }

    async waitFor(
        email: Email | string,
        regex: RegExp,
        options: WaitOptions = {},
    ): Promise<string> {
        if (!(regex instanceof RegExp)) {
            throw new TempMailError("regex must be a regular expression.")
        }

        return this.wait(email, regex, options)
    }

    private async wait(
        email: Email | string,
        regex: RegExp | undefined,
        options: WaitOptions,
    ) {
        const address = emailAddress(email)
        const key = mailboxKey(address)
        const interval = validatePollingInterval(
            options.pollingIntervalMs ?? this.pollingIntervalMs,
        )
        const consumed = this.consumedMessages.get(key) ?? new Set<string>()
        this.consumedMessages.set(key, consumed)

        while (true) {
            throwIfAborted(options.signal)

            const messages = await this.list(address, options.signal)
            const unreadMessages = messages
                .filter((message) => !consumed.has(message.id))
                .reverse()

            for (const summary of unreadMessages) {
                consumed.add(summary.id)

                let message: StoredMessage
                try {
                    message = await this.read(address, summary.id, options.signal)
                } catch (error) {
                    consumed.delete(summary.id)
                    throw error
                }

                const bodies = messageBodies(message)

                if (!regex) return bodies[0] ?? ""

                for (const body of bodies) {
                    const match = regexMatch(regex, body)
                    if (match !== undefined) return match
                }
            }

            await delay(interval, options.signal)
        }
    }

    private async list(email: string, signal?: AbortSignal) {
        const response = await this.request("/api/list", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
            signal,
        })

        if (!isRecord(response) || !Array.isArray(response.messages)) {
            throw new TempMailError("Invalid response received from /api/list.")
        }

        return response.messages.flatMap((message): MessageSummary[] =>
            isRecord(message) && typeof message.id === "string"
                ? [{ id: message.id }]
                : [],
        )
    }

    private async read(email: string, id: string, signal?: AbortSignal) {
        const response = await this.request("/api/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, id }),
            signal,
        })

        if (!isRecord(response) || !isRecord(response.content)) {
            throw new TempMailError("Invalid response received from /api/read.")
        }

        return {
            content: {
                text:
                    typeof response.content.text === "string"
                        ? response.content.text
                        : undefined,
                html:
                    typeof response.content.html === "string"
                        ? response.content.html
                        : undefined,
            },
        }
    }

    private async request(path: string, init?: RequestInit): Promise<unknown> {
        let response: Response

        try {
            response = await this.fetcher(`${this.baseUrl}${path}`, {
                ...init,
                cache: "no-store",
            })
        } catch (error) {
            if (init?.signal?.aborted) throw abortReason(init.signal)

            throw new TempMailError(`Failed to access ${path}.`, undefined, {
                cause: error,
            })
        }

        const body = await response.json().catch(() => undefined)

        if (!response.ok) {
            throw new TempMailError(
                errorMessage(body, `The API responded with HTTP ${response.status}.`),
                response.status,
            )
        }

        if (body === undefined) {
            throw new TempMailError(`The API returned invalid JSON at ${path}.`)
        }

        return body
    }
}

export default TempMail
