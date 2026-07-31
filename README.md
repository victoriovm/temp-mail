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

# Opcional em desenvolvimento
REDIS_SERVER=redis://localhost:6379

# Domínios separados por vírgula
NEXT_PUBLIC_MAIL_DOMAINS=example.com,example.net
```

Sem `REDIS_SERVER`, as mensagens ficam apenas na memória e são perdidas ao
reiniciar o servidor.

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
Content-Type: application/json

{ "email": "caixa@example.com" }
```

### ✉️ Ler mensagem

```http
POST /api/read
Content-Type: application/json

{ "email": "caixa@example.com", "id": "ID_DA_MENSAGEM" }
```

### 🌐 Listar domínios

```http
GET /api/domains
```

```json
{ "domains": ["example.com", "example.net"] }
```

## 🔐 Painel administrativo

Use a mesma `SECRET_KEY` configurada na API:

```text
https://SEU_DOMINIO/SEU_SECRET_KEY
```

## 📦 Produção

```bash
npm run build
npm start
```
