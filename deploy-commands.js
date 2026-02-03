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
         .setRequired(true)),
  new SlashCommandBuilder()
    .setName("ghti")
    .setDescription("Get Bible verses in Reverse Interlinear (English, Greek)")
    .addStringOption(opt => 
      opt.setName("reference")
         .setDescription("Book, chapter, verse (e.g., Matt 1:1-3)")
         .setRequired(true)),
  new SlashCommandBuilder()
    .setName("ghtgi")
    .setDescription("Get Bible verses in Interlinear (Greek, English)")
    .addStringOption(opt =>
      opt.setName("reference")
         .setDescription("Book, chapter, verse (e.g., Matt 1:1-3)")
         .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Deploying slash commands...");

    // Global (required for DMs)
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Global commands registered (DMs enabled, may take up to 1 hour)");

    // Guild (instant updates for testing)
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID
        ),
        { body: commands }
      );
      console.log("Guild commands registered (instant)");
    } else {
      console.log("GUILD_ID not set — skipping guild registration");
    }

  } catch (err) {
    console.error("Error deploying commands:", err);
  }
})();
