const DEFAULT_MAIL_DOMAIN = "example.com"

export function isValidDomain(domain: string) {
  return (
    domain.length > 0 &&
    domain.length <= 253 &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) &&
    domain.includes(".")
  )
}

export function getMailDomains() {
  const configuredDomains = (
    process.env.NEXT_PUBLIC_MAIL_DOMAINS || DEFAULT_MAIL_DOMAIN
  )
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(isValidDomain)

  return configuredDomains.length > 0
    ? [...new Set(configuredDomains)]
    : [DEFAULT_MAIL_DOMAIN]
}
