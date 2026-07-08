export async function requestDiscordLink(
  email: string,
  discordId: string,
  discordUsername: string
) {
  const response = await fetch(
    `${process.env.TL_API_URL}/discord/link/request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bot-Api-Key":
          process.env.DISCORD_BOT_API_KEY || ""
      },
      body: JSON.stringify({
        email,
        discordId,
        discordUsername
      }),
      signal: AbortSignal.timeout(15000)
    }
  );

  // .catch: um 502 do gateway devolve HTML e o .json() explodiria com erro opaco.
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || "Erro ao solicitar vinculação."
    );
  }

  return data;
}

export async function confirmDiscordCode(
  discordId: string,
  code: string
) {
  const response = await fetch(
    `${process.env.TL_API_URL}/discord/link/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bot-Api-Key":
          process.env.DISCORD_BOT_API_KEY || ""
      },
      body: JSON.stringify({
        discordId,
        code
      }),
      signal: AbortSignal.timeout(15000)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || "Código inválido."
    );
  }

  return data;
}