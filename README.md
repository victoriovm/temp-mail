# ✉ Temp Mail

A self-hosted disposable email api that uses Cloudflare Worker.

## Cloudflare Worker Config

This is the Cloudflare Worker configuration to forward emails (with Catch-All) from your domain to the API:

```js
import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const API_URL = "https://YOUR_API/api/receive";
    const AUTH_TOKEN = "YOUR_TOKEN";

    const to = message.to;
    const from = message.from;
    const subject = message.headers.get("subject") || "Sem assunto";
    const emailParsed = await PostalMime.parse(message.raw);

    const payload = {
      email: to,
      message: {
        from,
        subject,
        text: btoa(unescape(encodeURIComponent(emailParsed.html)))
      }
    };

    await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(payload)
    });
  }
};
```

## API Routes

### Receive Email

`POST /api/receive`

Requires authentication - Header: Authorization: Bearer YOUR_SECRET_TOKEN

### List Mails

`POST /api/list`

```json
{
  "email": "user_mail"
}
```

### Read Mail
`POST /api/read`

```json
{
  "email": "user_mail",
  "id": "message_id"
}
```
