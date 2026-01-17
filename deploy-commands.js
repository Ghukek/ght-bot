const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

const commands = [
  new SlashCommandBuilder()
    .setName("ght")
    .setDescription("Get Bible verses")
    .addStringOption(opt => 
      opt.setName("reference")
         .setDescription("Book, chapter, verse (e.g., Matt 1:1-3)")
         .setRequired(true)),
  new SlashCommandBuilder()
    .setName("ghtg")
    .setDescription("Get Bible verses in Greek")
    .addStringOption(opt =>
      opt.setName("reference")
         .setDescription("Book, chapter, verse (e.g., Matt 1:1-3)")
         .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("Slash commands registered globally!");
  } catch (err) {
    console.error(err);
  }
})();
