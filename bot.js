require('dotenv').config();

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("GHTBot running!"));

app.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

const COMMANDS = {
  "!ght":  { id: "uid",  text: "raw"   },
  "!ghtg": { id: "guid", text: "greek" }
};

const SUPERSCRIPT = {
  "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴",
  "5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹"
};

function superscript(n) {
  return String(n).split("").map(d => SUPERSCRIPT[d]).join("");
}

const BOOKS = {
  // Gospels
  "matthew": 40, "matt": 40, "mt": 40,
  "mark": 41, "mk": 41,
  "luke": 42, "lk": 42,
  "john": 43, "jn": 43,
  "acts": 44,
  "romans": 45, "rom": 45, "ro": 45,
  "1cor": 46, "1corinthians":46,
  "2cor": 47, "2corinthians":47,
  "galatians": 48, "gal": 48,
  "ephesians": 49, "eph":49,
  "philippians": 50, "phil": 50,
  "colossians": 51, "col":51,
  "1thessalonians": 52, "1thess": 52,
  "2thessalonians": 53, "2thess": 52,
  "1timothy": 54, "1tim":54,
  "2timothy": 55, "2tim":55,
  "titus": 56,
  "philemon": 57, "phm":57, 
  "hebrews": 58, "heb":58,
  "james": 59,
  "1peter": 60, "1pet":60,
  "2peter": 61, "2pet":61,
  "1john" : 62,
  "2john" : 63,
  "3john" : 64,
  "jude" : 65,
  "revelation" : 66, "rev": 66
};

const bookNames = {
    40: "Good-message according-to Matthew",
    41: "Good-message according-to Mark",
    42: "Good-message according-to Luke",
    43: "Good-message according-to John",
    44: "Practices of{the sent-off[one]s}",
    45: "Toward Romans",
    46: "Toward Corinthians, Alpha",
    47: "Toward Corinthians, Beta",
    48: "Toward Galatians",
    49: "Toward Ephesians",
    50: "Toward Philippians",
    51: "Toward Colossians",
    52: "Toward Thessalonians, Alpha",
    53: "Toward Thessalonians, Beta",
    54: "Toward Timothy, Alpha",
    55: "Toward Timothy, Beta",
    56: "Toward Titus",
    57: "Toward Philemon",
    58: "Toward Hebrews",
    59: "[James]",
    60: "[1 Peter]",
    61: "[2 Peter]",
    62: "[1 John]",
    63: "[2 John]",
    64: "[3 John]",
    65: "[Jude]",
    66: "[Revelation]"
}

// Database stores [word1]_[word2]_[word1] cases as duplicates.
function getSkipCount(word) {
  const count = (word.match(/_/g) || []).length;
  if (count === 2) return 1; // skip next 1 word
  if (count === 3) return 2; // skip next 2 words
  return 0;                  // no skip
}

function parseBook(raw) {
  raw = raw.toLowerCase().trim();

  // Normalize roman numerals
  raw = raw
    .replace(/^i\s+/, "1 ")
    .replace(/^ii\s+/, "2 ")
    .replace(/^iii\s+/, "3 ");

  // Handle numbered books
  const m = raw.match(/^(\d)\s*(.+)$/);
  if (m) {
    const num = m[1];
    const base = m[2];

    if (base.startsWith("cor")) return 45 + Number(num); // 1–2 Cor
    if (base.startsWith("thess")) return 51 + Number(num); // 1–2 Thess
    if (base.startsWith("tim")) return 53 + Number(num); // 1–2 Tim
    if (base.startsWith("pet")) return 59 + Number(num); // 1–2 Pet
    if (base.startsWith("john")) return 61 + Number(num); // 1–3 John
  }

  return BOOKS[raw] ?? null;
}

function parseReference(input) {
  const m = input.match(
    /^(.+?)\s+(\d+):(\d+)(?:[-–](?:(\d+):)?(\d+))?$/
  );
  if (!m) return null;

  const book = parseBook(m[1]);
  if (!book) return null;

  const chapStart = parseInt(m[2], 10);
  const verseStart = parseInt(m[3], 10);

  const chapEnd = m[4]
    ? parseInt(m[4], 10)
    : chapStart;

  const verseEnd = parseInt(m[5] ?? m[3], 10);

  return {
    book,
    chapStart,
    verseStart,
    chapEnd,
    verseEnd
  };
}

function makeBounds(ref) {
  const start =
    ref.book * 1_000_000 +
    ref.chapStart * 1_000 +
    ref.verseStart;

  const end =
    ref.book * 1_000_000 +
    ref.chapEnd * 1_000 +
    ref.verseEnd;

  return {
    start: start + 0.00,
    end:   end   + 0.99
  };
}

function chapterFromVerseId(vid) {
  return Math.floor((vid % 1_000_000) / 1_000);
}

const Database = require("better-sqlite3");
const db = new Database("concordance.db", {
  readonly: true,
  fileMustExist: true
});

try {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1")
    .get();

  console.log("DB OK, first table:", row?.name);
} catch (err) {
  console.error("DB error:", err);
}

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

async function sendVerse(interactionOrMessage, input, options = {}) {
  // Determine command type & DB column
  const { id = "uid", text = "raw" } = options;

  // Parse reference
  const ref = parseReference(input);
  if (!ref) {
    const replyText = "Invalid reference. Use format: Matt 1:1-3";
    if (interactionOrMessage.reply) await interactionOrMessage.reply(replyText);
    else interactionOrMessage.channel.send(replyText);
    return;
  }

  const { start, end } = makeBounds(ref);

  let rows;

  try {
    const stmt = db.prepare(`
      SELECT CAST(${id} AS INT) AS verse_id, ${text} AS word
      FROM entries
      WHERE ${id} BETWEEN ? AND ?
      ORDER BY ${id}
    `);
    rows = stmt.all(start, end);
  } catch (err) {
    console.error(err);
    const replyText = "DB error";
    if (interactionOrMessage.reply) {
      await interactionOrMessage.reply(replyText);
    } else {
      interactionOrMessage.channel.send(replyText);
    }
    return;
  }

  if (!rows || rows.length === 0) {
    const replyText = "(no data)";
    if (interactionOrMessage.reply) {
      await interactionOrMessage.reply(replyText);
    } else {
      interactionOrMessage.channel.send(replyText);
    }
    return;
  }

  const firstVerseId = rows[0].verse_id;
  const bookNum = Math.floor(firstVerseId / 1_000_000);
  const bookName = bookNames[bookNum] ?? "Unknown Book";

  let output = `**${bookName}**\n`;

  let lastVerse = null;
  let lastChapter = null;
  let skipNext = 0;

  for (let i = 0; i < rows.length; i++) {
    if (skipNext > 0) {
      skipNext--;
      continue;
    }

    const r = rows[i];
    if (!r.word) continue;

    const verseId = r.verse_id;
    const chapter = chapterFromVerseId(verseId);
    const verseNum = verseId % 1000;

    if (chapter !== lastChapter) {
      output += `\u00A0**${superscript(chapter)}**\u00A0`;
      lastChapter = chapter;
      lastVerse = null;
    }

    if (verseId !== lastVerse) {
      output += `\u00A0${superscript(verseNum)}\u00A0`;
      lastVerse = verseId;
    }

    output += r.word + " ";
    skipNext = getSkipCount(r.word);
  }

  let replyText = output || "(no data)";

  if (replyText.length > 2000) {
    replyText = replyText.slice(0, 1997) + "...";
  }

  if (interactionOrMessage.deferred || interactionOrMessage.replied) {
    await interactionOrMessage.followUp(replyText);
  } else if (interactionOrMessage.reply) {
    await interactionOrMessage.reply(replyText);
  } else {
    interactionOrMessage.channel.send(replyText);
  }
}

client.on("messageCreate", message => {
  if (message.author.bot) return;

  const cmd = Object.keys(COMMANDS)
    .find(c => message.content.startsWith(c + " "));

  if (!cmd) return;

  const { id, text } = COMMANDS[cmd];
  const input = message.content.slice(cmd.length).trim();

  sendVerse(message, input, { id, text });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  await interaction.deferReply(); // <-- tells Discord "I'm working"

  const input = interaction.options.getString("reference");
  const commandName = interaction.commandName;

  const { id, text } = commandName === "ght" ? { id: "uid", text: "raw" } : { id: "guid", text: "greek" };

  sendVerse(interaction, input, { id, text });
});

