//index.js
const { Client, Collection, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates
	]
});
const config = require('./config.json');
const fs = require('fs');
const token = process.env['token'];

const Redis = require("ioredis");
const redis = new Redis({
	port: 6379, // Redis port
	host: "es-noram.redis.cache.windows.net", // Redis host
	password: "",
	timeout: 200
});

const wait = require('node:timers/promises').setTimeout;

function creatCommand(config) {
	console.log(config)
	let command = new SlashCommandBuilder()
	const keys = Object.keys(config)
	for (let key in keys) {
		command[keys[key]](config[keys[key]])
	}
	return command
}

const commands = new Collection()
fs.readdir('./commands/', (err, files) => {
	// return
	if (err) return console.error(err);
	files.forEach(file => {
		if (!file.endsWith('.js')) return;
		const props = require(`./commands/${file}`);
		console.log(`Attempting to load command ${file}`);
		let newCommand = creatCommand(props.config);
		console.log(newCommand)
		commands.set(props.config.setName, [newCommand, props.run,props]);
	});
	loadCommands()
})

loadCommands = () => {
	//use REST to create the slash commands
	const rest = new REST({ version: "10" }).setToken(token);
	const commandList = commands.map(e => e[0])
	console.log("commands", JSON.parse(JSON.stringify(commands)))
	rest.put(Routes.applicationGuildCommands("1003141876523737128", "930888236472103002"), { body: commandList })
		.then(() => console.log('Successfully registered application commands.'))
		.catch(console.error);
}


client.on('ready', () => {
	console.log(`${client.user.tag} is online!`);
})

client.on('interactionCreate', async interaction => {
	try {
		if (interaction.isChatInputCommand()){
			await commands.get(interaction.commandName)[1](client, interaction, interaction.options)
		} else if (interaction.isModalSubmit()) {
			await commands.get(interaction.customId.split("_")[0])[2].modal(client, interaction)
		} else if (interaction.isButton()) {
			await commands.get(interaction.customId.split("_")[0])[2].button(client, interaction)
		} else if (interaction.isSelectMenu()) {
			await commands.get(interaction.customId.split("_")[0])[2].select(client, interaction)
		}

	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.login(process.env['token']).catch(e=>console.error(e));
