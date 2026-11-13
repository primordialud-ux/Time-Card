export async function sendDiscordAlert(title, description, recipientName = 'Team') {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('DISCORD_WEBHOOK_URL is not set. Skipping notification.');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `📋 ${title}`,
          description: `**Recipient / Target:** ${recipientName}\n\n${description}`.slice(0, 4096),
          color: 3447003,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!response.ok) {
      console.error('Discord API returned an error status:', response.status);
    } else {
      console.log('Discord notification sent successfully.');
    }
  } catch (error) {
    const detail = String(error?.message || error).replaceAll(webhookUrl, '[redacted]');
    console.error('Failed to dispatch Discord webhook:', detail);
  }
}
