# 📬 Temp Mail

Serviço simples de e-mail temporário feito com Next.js.

## 🚀 Instalação

Requer Node.js 20.9 ou superior.

```bash
npm install
cp .env.example .env
npm run dev
```

Acesse `http://localhost:3000`.

## ⚙️ Variáveis de ambiente

```env
# Protege o recebimento e libera o painel em /SEU_SECRET_KEY
SECRET_KEY=sua-chave-segura

# Opcional. Se definida, o frontend pede a senha e todas as rotas /api
# exigem o header Authorization: Bearer SENHA.
PASSWORD=minha-senha

# Opcional em desenvolvimento
REDIS_SERVER=redis://localhost:6379

# Domínios separados por vírgula
NEXT_PUBLIC_MAIL_DOMAINS=example.com,example.net
```

Sem `REDIS_SERVER`, as mensagens ficam apenas na memória e são perdidas ao
reiniciar o servidor.

Sem `PASSWORD`, o acesso fica aberto: nenhuma rota exige autenticação. Com
`PASSWORD` definida, o frontend mostra um popup pedindo a senha, guarda o valor
no `localStorage` do navegador (para não pedir de novo) e envia
`Authorization: Bearer SENHA` em todas as chamadas de `/api`. Uma resposta 401
limpa a senha salva e o popup volta a aparecer.

O `POST /api/receive` aceita tanto a `PASSWORD` quanto a `SECRET_KEY`, então o
Worker continua funcionando sem alterações.

## ☁️ Cloudflare Email Worker

Substitua `SEU_DOMINIO` pela URL do servidor e `SEU_SECRET_KEY` pelo mesmo valor
configurado no projeto.

```js
const MAX_EMAIL_SIZE = 10 * 1024 * 1024;

export default {
  async email(message) {
    if (message.rawSize > MAX_EMAIL_SIZE) {
      return;
    }

    await fetch('https://SEU_DOMINIO/api/receive', {
      method: "POST",
      headers: {
        "authorization": "Bearer SEU_SECRET_KEY",
        "Content-Type": "message/rfc822",
        "X-Envelope-To": message.to,
        "X-Envelope-From": message.from
      },
      body: await new Response(message.raw).text(),
      redirect: "manual"
    });
  }
};
```

No Cloudflare, configure o Email Routing para encaminhar as mensagens para esse
Worker.

## 🔌 API

Com `PASSWORD` definida, todas as rotas exigem o header
`Authorization: Bearer SENHA`. Sem `PASSWORD`, os exemplos abaixo funcionam sem
o header (exceto `/api/receive`, que sempre exige credencial).

### 📥 Receber e-mail

```http
POST /api/receive
Authorization: Bearer SEU_SECRET_KEY
Content-Type: message/rfc822
X-Envelope-To: caixa@example.com
```

O corpo deve conter o e-mail completo em formato MIME/RFC822. O formato JSON
antigo continua compatível.

### 📋 Listar mensagens

```http
POST /api/list
Authorization: Bearer SENHA
Content-Type: application/json

{ "email": "caixa@example.com" }
```

### ✉️ Ler mensagem

```http
POST /api/read
Authorization: Bearer SENHA
Content-Type: application/json

{ "email": "caixa@example.com", "id": "ID_DA_MENSAGEM" }
```

### 🔑 Validar senha

```http
POST /api/auth
Authorization: Bearer SENHA
```

Responde `200` quando a senha confere e `401` quando está ausente ou incorreta.
É a rota usada pelo popup do frontend.

### 🌐 Listar domínios

```http
GET /api/domains
Authorization: Bearer SENHA
```

```json
{ "domains": ["example.com", "example.net"] }
```

## 🔐 Painel administrativo

Use a mesma `SECRET_KEY` configurada na API:

```text
https://SEU_DOMINIO/SEU_SECRET_KEY
```

Se `PASSWORD` estiver definida, o painel também pede a senha antes de exibir as
mensagens.

## 📦 Produção

```bash
npm run build
npm start
```
