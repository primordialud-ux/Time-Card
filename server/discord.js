export async function sendDiscordNotification(title, message, recipient) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return { status: 'not_configured' };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `📋 ${title}`,
          description: `**Recipient:** ${recipient}\n\n${message}`.slice(0, 4096),
          color: 5814783,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!response.ok) throw new Error(`Discord webhook returned HTTP ${response.status}.`);
    console.log('Discord alert dispatched.');
    return { status: 'sent' };
  } catch (error) {
    const detail = String(error?.message || error).replaceAll(webhookUrl, '[redacted]');
    console.error('Discord webhook error:', detail);
    return { status: 'failed' };
  }
}
