---
name: temp-mail
description: How to use the @victoriovm/temp-mail package to test email flows (signup confirmation, password reset, OTP codes) from JS/TS tests and scripts. Use whenever a test or script needs a real inbox — waiting for an email to arrive, extracting a verification code, or following a confirmation link.
---

# Temp Mail for tests

`@victoriovm/temp-mail` is a small JS/TS client for a Temp Mail server. Reach
for it when a test must receive a real email: confirming a signup, resetting a
password, reading a 6-digit code, following a confirmation link.

## Mental model

- `new TempMail(options)` points at a Temp Mail server.
- Addresses come from `random()` (server domain + random username),
  `domains()` / `randomDomain()` (server list), or `createMail(user, domain)`
  (your own username).
- `waitForAnyMail` / `waitForMailMatching` poll the inbox until a message shows
  up, then return its body (or the regex match).
- Each message is consumed once per `TempMail` instance: a second wait only
  sees newer mail.

## Install

The package is published on GitHub Packages, so the scope needs its registry:

```ini
# .npmrc
@victoriovm:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm i @victoriovm/temp-mail
```

## Canonical usage

```ts
import { TempMail, TempMailError } from "@victoriovm/temp-mail"

const mail = new TempMail({
  baseUrl: process.env.TEMPMAIL_BASE_URL, // or TEMP_MAIL_BASE_URL
  password: process.env.TEMPMAIL_PASSWORD, // only when the server sets PASSWORD
  pollingIntervalMs: 1_000,
})

// A readable address is easier to debug than a random one.
const account = mail.createMail("qa.user", await mail.randomDomain())

// ... submit the form / call the API under test with account.email ...

const code = await mail.waitForMailMatching(account.email, /(\d{6})/)
const link = await mail.waitForMailMatching(account.email, /https?:\/\/\S+confirm\S+/)
```

## API at a glance

| Member | Returns | Notes |
| --- | --- | --- |
| `domains()` | `string[]` | domains the server accepts (async) |
| `randomDomain()` | `string` | one domain from that list (async) |
| `random()` | `{ username, email }` | random username + random domain (async) |
| `createMail(username, domain)` | `{ username, email }` | no API call; trims, lowercases, accepts `@domain` |
| `waitForAnyMail(email, options?)` | body string (text or HTML) | resolves on the next unseen message |
| `waitForMailMatching(email, regex, options?)` | matched text | resolves on the first unseen body matching the regex |

`email` accepts the address string or the object from `random()` /
`createMail()`. `options` is `{ signal?: AbortSignal, pollingIntervalMs?: number }`.
`createMail` throws `TempMailError` for malformed usernames or domains, which
catches typos in fixtures before the test starts.

## Auth

When the server has `PASSWORD` set, every request must carry
`Authorization: Bearer <password>`. Pass it as `password`; a missing or wrong
password rejects with `TempMailError` and `status === 401`. When the server has
no password configured, omit the option — no header is sent.

## Pitfalls

- A wait for a message that never arrives polls forever. Always pass an
  `AbortSignal` with a timeout so the test fails fast.
- Mailboxes often receive more than one message (welcome + code). Prefer
  `waitForMailMatching` with a regex instead of `waitForAnyMail`, which returns
  the first unseen body regardless of content.
- Consumption state lives in memory per instance; creating a new `TempMail`
  re-sees the messages already present in the mailbox.
- `createMail` only validates the format — the server decides whether the domain
  actually accepts mail, so pair it with `domains()` when that matters.