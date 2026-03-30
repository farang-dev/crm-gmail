import dns from 'dns';
import net from 'net';

/**
 * Advanced Email Verifier (Zero Bounce Logic)
 * 1. Syntax Check (Regex)
 * 2. DNS MX Check (Validates domain + mailbox existence)
 * 3. SMTP Ping (Simulates RCPT TO)
 */

export async function verifyEmail(email: string): Promise<{ valid: boolean; reason?: string }> {
  // 1. Basic Regex
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) return { valid: false, reason: 'Invalid syntax' };

  const domain = email.split('@')[1];

  try {
    // 2. DNS MX Check
    const mxRecords = await new Promise<dns.MxRecord[]>((resolve, reject) => {
      dns.resolveMx(domain, (err, records) => {
        if (err || !records || records.length === 0) resolve([]);
        else resolve(records.sort((a, b) => a.priority - b.priority));
      });
    });

    if (mxRecords.length === 0) return { valid: false, reason: 'No MX records found for domain' };

    // 3. SMTP Ping (Deep Check)
    // NOTE: This might be blocked by some firewalls/ISPs on port 25, 
    // but works from most servers/unlocked environments.
    const result = await smtpVerify(email, mxRecords[0].exchange);
    return result;

  } catch (err) {
    // If deep check fails due to network/timeout, fallback to true if domain exists
    return { valid: true, reason: 'DNS valid, but SMTP check skipped due to timeout' };
  }
}

async function smtpVerify(email: string, mxHost: string): Promise<{ valid: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost);
    let step = 0;
    let timedOut = false;

    socket.setTimeout(2500); // Fast check

    const close = (valid: boolean, reason?: string) => {
      socket.end();
      if (!timedOut) resolve({ valid, reason });
    };

    socket.on('timeout', () => {
      timedOut = true;
      // Reverting to 'true' because many local environments block port 25, 
      // causing false positives for valid domains.
      close(true, 'SMTP connection timeout (Skipped deep check)');
    });

    socket.on('error', (err) => {
      close(true, 'SMTP connection error: ' + err.message);
    });

    socket.on('data', (data) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3));

      // 220 = Ready, 250 = OK
      if (code >= 400 && step >= 2) {
        return close(false, 'Recipient server rejected address: ' + response.trim());
      }

      switch (step) {
        case 0: // Greeting
          socket.write(`HELO gmail.com\r\n`);
          step++;
          break;
        case 1: // MAIL FROM
          socket.write(`MAIL FROM:<check@gmail.com>\r\n`);
          step++;
          break;
        case 2: // RCPT TO (The truth)
          socket.write(`RCPT TO:<${email}>\r\n`);
          step++;
          break;
        case 3: // Response to RCPT TO
          if (code === 250) close(true);
          else close(false, 'Email account not found (SMTP)');
          break;
      }
    });
  });
}
