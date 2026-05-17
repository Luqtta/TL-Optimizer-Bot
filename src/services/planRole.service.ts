import { GuildMember } from "discord.js";

export async function syncPlanRoles(
  member: GuildMember,
  plan: string
) {
  const monthlyRole =
    process.env.ROLE_MONTHLY_ID;

  const yearlyRole =
    process.env.ROLE_YEARLY_ID;

  const lifetimeRole =
    process.env.ROLE_LIFETIME_ID;

  const allRoles = [
    monthlyRole,
    yearlyRole,
    lifetimeRole
  ].filter(Boolean) as string[];

  await member.roles.remove(allRoles);

  if (plan === "MONTHLY" && monthlyRole) {
    await member.roles.add(monthlyRole);
  }

  if (plan === "YEARLY" && yearlyRole) {
    await member.roles.add(yearlyRole);
  }

  if (plan === "LIFETIME" && lifetimeRole) {
    await member.roles.add(lifetimeRole);
  }
}