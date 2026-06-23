import { Resend } from "resend";
import { PAYMENT_METHODS, type PaymentMethodKey } from "./payment-methods";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #e4e4e7; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 40px auto; border: 1px solid #27272a; background: #18181b; }
    .header { background: #09090b; border-bottom: 1px solid #27272a; padding: 20px 24px; }
    .header h1 { margin: 0; font-size: 13px; letter-spacing: 0.15em; color: #a1a1aa; text-transform: uppercase; }
    .body { padding: 24px; }
    .amount { font-size: 28px; font-weight: bold; color: #f4f4f5; margin: 8px 0; }
    .label { font-size: 11px; letter-spacing: 0.12em; color: #71717a; text-transform: uppercase; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #27272a; }
    .row:last-child { border-bottom: none; }
    .link { display: inline-block; margin-top: 20px; padding: 10px 20px; border: 1px solid #52525b; color: #a1a1aa; text-decoration: none; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
    .footer { padding: 16px 24px; border-top: 1px solid #27272a; font-size: 10px; color: #52525b; letter-spacing: 0.08em; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="header"><h1>Debt Tracker</h1></div>
  <div class="body">${body}</div>
  <div class="footer">Esta mensagem foi gerada automaticamente. Não responda este email.</div>
</div>
</body>
</html>`;
}

interface PaymentNotificationData {
  personName: string;
  personEmail: string;
  accessCode: string;
  paymentAmount: number;
  paymentMethod: string;
  totalPaid: number;
  totalOwed: number;
  remaining: number;
}

export async function sendPaymentNotification(data: PaymentNotificationData) {
  if (!process.env.RESEND_API_KEY) return;

  const methodLabel =
    PAYMENT_METHODS[data.paymentMethod as PaymentMethodKey] ?? data.paymentMethod;
  const consultarUrl = `${process.env.NEXT_PUBLIC_APP_URL}/consultar/${data.accessCode}`;

  const body = `
    <p class="label">Olá, ${data.personName}</p>
    <p style="margin: 12px 0 4px; color: #a1a1aa; font-size: 13px;">Um pagamento foi registrado na sua conta.</p>

    <div class="amount">${fmt(data.paymentAmount)}</div>
    <p class="label">via ${methodLabel}</p>

    <div style="margin-top: 20px; border-top: 1px solid #27272a; padding-top: 16px;">
      <div class="row">
        <span class="label">Total pago</span>
        <span style="color: #4ade80;">${fmt(data.totalPaid)}</span>
      </div>
      <div class="row">
        <span class="label">Saldo restante</span>
        <span style="color: ${data.remaining > 0 ? "#f87171" : "#4ade80"};">${fmt(data.remaining)}</span>
      </div>
      <div class="row">
        <span class="label">Total original</span>
        <span>${fmt(data.totalOwed + data.totalPaid)}</span>
      </div>
    </div>

    <a class="link" href="${consultarUrl}">Ver extrato completo</a>
  `;

  await getResend().emails.send({
    from: "Debt Tracker <noreply@wlcsv.dev>",
    to: data.personEmail,
    subject: `Pagamento de ${fmt(data.paymentAmount)} registrado`,
    html: baseLayout("Pagamento registrado", body),
  });
}

interface DebtNotificationData {
  personName: string;
  personEmail: string;
  accessCode: string;
  debtAmount: number;
  debtDescription: string;
  debtDate: Date;
  newBalance: number;
}

export async function sendDebtNotification(data: DebtNotificationData) {
  if (!process.env.RESEND_API_KEY) return;

  const consultarUrl = `${process.env.NEXT_PUBLIC_APP_URL}/consultar/${data.accessCode}`;
  const dateStr = data.debtDate.toLocaleDateString("pt-BR");

  const body = `
    <p class="label">Olá, ${data.personName}</p>
    <p style="margin: 12px 0 4px; color: #a1a1aa; font-size: 13px;">Uma nova dívida foi adicionada à sua conta.</p>

    <div class="amount">${fmt(data.debtAmount)}</div>
    <p style="color: #a1a1aa; font-size: 13px; margin: 4px 0;">${data.debtDescription}</p>
    <p class="label">${dateStr}</p>

    <div style="margin-top: 20px; border-top: 1px solid #27272a; padding-top: 16px;">
      <div class="row">
        <span class="label">Novo saldo devedor</span>
        <span style="color: #f87171;">${fmt(data.newBalance)}</span>
      </div>
    </div>

    <a class="link" href="${consultarUrl}">Ver extrato completo</a>
  `;

  await getResend().emails.send({
    from: "Debt Tracker <noreply@wlcsv.dev>",
    to: data.personEmail,
    subject: `Nova dívida: ${data.debtDescription} — ${fmt(data.debtAmount)}`,
    html: baseLayout("Nova dívida registrada", body),
  });
}
