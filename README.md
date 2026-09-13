# 📬 @victoriovm/temp-mail

Cliente JavaScript/TypeScript para a API do Temp Mail: cria caixas temporárias
e espera pelos e-mails que chegarem nelas. Feito para testes automatizados
(confirmação de cadastro, código de verificação, link de reset de senha...).

## Instalação

O pacote é publicado no GitHub Packages:

```bash
npm i @victoriovm/temp-mail
```

Se o npm não encontrar o pacote, crie um `.npmrc` na raiz do projeto:

```ini
@victoriovm:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

## Uso rápido

```ts
import { TempMail } from "@victoriovm/temp-mail"

const mail = new TempMail({
  baseUrl: "https://your-tempmail.com",
  password: "your-password", // only when the server sets PASSWORD
})

const account = await mail.random()
console.log(account.email) // tm-1a2b3c...@example.com

// waits for the next email and returns its body
const body = await mail.waitForAnyMail(account.email)

// waits for an email and returns the text matched by the regex
const code = await mail.waitForMailMatching(account.email, /(\d{6})/)
```

## Opções

| Opção | Padrão | Descrição |
| --- | --- | --- |
| `baseUrl` | env `TEMPMAIL_BASE_URL` / `TEMP_MAIL_BASE_URL` | URL do servidor Temp Mail |
| `password` | — | senha do servidor (`Authorization: Bearer`) |
| `pollingIntervalMs` | `3000` | intervalo entre verificações da caixa |
| `fetch` | `globalThis.fetch` | implementação de `fetch` customizada |

## Métodos

### Endereços

- `domains()` → `string[]` — devolve os domínios aceitos pelo servidor.
- `randomDomain()` → `string` — devolve um domínio aleatório da lista.
- `random()` → `{ username, email }` — cria um endereço aleatório com um dos
  domínios do servidor.
- `createMail(username, domain)` → `{ username, email }` — monta o endereço com
  os dados informados, sem chamar a API. Apara espaços, converte para minúsculas
  e aceita o domínio com ou sem `@` na frente.

```ts
const domains = await mail.domains() // ["example.com", "mail.example.net"]
const domain = await mail.randomDomain() // "example.com"

const account = mail.createMail("QA.User", "@example.com")
// { username: "qa.user", email: "qa.user@example.com" }
```

### Espera por mensagens

- `waitForAnyMail(email, options?)` — espera a próxima mensagem inédita e
  devolve o corpo (texto ou HTML).
- `waitForMailMatching(email, regex, options?)` — espera a próxima mensagem
  inédita cujo corpo casa com o regex e devolve o trecho encontrado.

O `email` pode ser a string do endereço ou o objeto devolvido por `random()` /
`createMail()`. `options` aceita `signal` (`AbortSignal`) e
`pollingIntervalMs`.

## Senha

Se o servidor estiver com `PASSWORD` definida, informe `password` nas opções:
todas as requisições passam a enviar `Authorization: Bearer <senha>`. Sem a
senha (ou com a errada), as chamadas falham com `TempMailError` e
`status: 401`.

## Erros e timeout

```ts
import { TempMail, TempMailError } from "@victoriovm/temp-mail"

const controller = new AbortController()
setTimeout(() => controller.abort(), 30_000)

try {
  const code = await mail.waitForMailMatching(account.email, /(\d{6})/, {
    signal: controller.signal,
  })
} catch (error) {
  if (error instanceof TempMailError) console.error(error.status, error.message)
  throw error
}
```

Cada mensagem é consumida uma única vez por instância: esperas seguintes na
mesma instância ignoram os e-mails já lidos.