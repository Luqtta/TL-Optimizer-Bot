import {
  SlashCommandBuilder,
  ChatInputCommandInteraction
} from "discord.js";

export const pingCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Responde com Pong!"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply("Pong!");
  }
};