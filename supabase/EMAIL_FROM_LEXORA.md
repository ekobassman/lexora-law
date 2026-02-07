# Email da Lexora (non da Supabase)

## Conferma email registrazione

Le email di conferma account sono inviate da **Supabase Auth**. Per farle arrivare da Lexora invece che da Supabase:

1. Vai su **Supabase Dashboard** → **Authentication** → **Email Templates** (o **SMTP Settings**).
2. Configura **Custom SMTP**:
   - **Sender email**: `noreply@lexora.app` (o il dominio verificato che usi)
   - **Sender name**: `Lexora`
   - **Host**: usa il server SMTP del tuo provider (es. Resend: `smtp.resend.com`, porta 465)
   - **Username/Password**: le credenziali del provider (per Resend: API key come password)
3. Salva. Da quel momento le conferme arriveranno con mittente Lexora.

Se usi **Resend**: verifica prima il dominio (lexora.app) in Resend Dashboard, poi in Supabase inserisci SMTP host `smtp.resend.com`, porta 465, e come password la tua Resend API key.

## Contact form e Support form

Le Edge Function `send-contact-email` e `send-support-email` usano già Resend con mittente **Lexora** (nome visualizzato). Per inviare da un indirizzo @lexora.app:

- Imposta la variabile d’ambiente **`LEXORA_FROM_EMAIL`** nelle secrets di Supabase (es. `Lexora <noreply@lexora.app>`).
- Verifica il dominio in Resend. Se non imposti `LEXORA_FROM_EMAIL`, viene usato `Lexora <onboarding@resend.dev>` (il nome resta "Lexora").
