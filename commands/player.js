// commands/player.js
const ytdl = require('ytdl-core');
const {
        createAudioPlayer,
        joinVoiceChannel,
        createAudioResource,
        AudioPlayerStatus,
        getVoiceConnection
} = require('@discordjs/voice');
const {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        Collection,
        EmbedBuilder,
        MessageActionRow,
        TextInputBuilder,
        ModalBuilder,
        SelectMenuBuilder
} = require('discord.js');

const db = require("../db.js");

async function handleAudioResource(url) {
        return createAudioResource(await ytdl(url, {
                filter: 'audioonly',
                highWaterMark: 10485760,
                dlChunkSize: 0
        }));
}

async function tryStart(interaction) {
        const channel = interaction.member.voice.channel

        const player = (await db.get(interaction.guildId)).player
        const currentSong = player.playlist[player.playlistPointer]
        const music = await handleAudioResource(currentSong)
        channel.guild.resources.set("player", music)

        const AudioPlayer = channel.guild.resources.get("AudioPlayer") || createAudioPlayer({})
        channel.guild.resources.set("AudioPlayer", AudioPlayer)

        channel.guild.resources.get("connection")
                .subscribe(AudioPlayer);

        AudioPlayer.play(music);

        AudioPlayer.on('idle', () => {
                console.log("ended")
        })
}

async function showCurrntPlaying(interaction) {

        const player = (await db.get(interaction.guildId)).player
        const channel = interaction.member.voice.channel
        if( interaction.member.voice.channelId !=interaction.guild.members.me.voice.channelId)return { content:'use has left the channel', embeds: [], ephemeral: true, components: [] };
        const buttons = new ActionRowBuilder()
                .addComponents(
                        new ButtonBuilder()
                                .setCustomId('player_BEFORE')
                                .setEmoji('⏮️')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(player.playlistPointer == 0),
                        new ButtonBuilder()
                                .setCustomId('player_' + (!player.settings.paused ? "PAUSE" : "PLAY"))
                                .setEmoji((!player.settings.paused ? '⏸️' : '▶️'))
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(false),
                        new ButtonBuilder()
                                .setCustomId('player_NEXT')
                                .setEmoji('⏭️')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(player.playlistPointer + 1 > player.playlist.length),
                        new ButtonBuilder()
                                .setCustomId('player_ADD')
                                .setEmoji('➕')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(false)
                );
        const buttons2 = new ActionRowBuilder()
                .addComponents(
                        new ButtonBuilder()
                                .setCustomId('player_CLEAR')
                                .setEmoji('🗑️')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(player.playlist.length < 0),
                        new ButtonBuilder()
                                .setCustomId('player_STOP')
                                .setEmoji('🛑')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(false)
                )

        // console.log(player.playlist.length)
        if (player.playlist.length > 0 && player.playlistPointer + 1 <= player.playlist.length) {
                const currentSong = player.playlist[player.playlistPointer]
                // console.log(currentSong)

                const url = currentSong;
                const ytInfo = await ytdl.getInfo(url);
                const min = Math.floor(ytInfo.videoDetails.lengthSeconds / 60)
                const sec = ytInfo.videoDetails.lengthSeconds % 60
                const image = ytInfo.videoDetails.thumbnails[ytInfo.videoDetails.thumbnails.length - 1]
                const pfp = interaction.member.user.avatar + (interaction.member.user.avatar.startsWith("a_") ? ".gif" : ".png")

                const current = channel.guild.resources.get("player").playbackDuration / 1000;
                const currentMin = Math.floor(current / 60);
                const currentSec = Math.round(current % 60);

                track = Array(Math.round((30 * current) / ytInfo.videoDetails.lengthSeconds)).fill('━');
                track.push('⬤');
                track=track.join('').padEnd(30, '─');

                const embed = new EmbedBuilder()
                        .setTitle('music player')
                        .setDescription('**now playing:**\n[*' + ytInfo.videoDetails.title + '*](https://www.youtube.com/watch?v=' + ytInfo.videoDetails.videoId + ')')
                        .setColor('#ff0000')
                        .addFields({ name: 'track', value: `${String(currentMin).padStart(2, "0")}:${String(currentSec).padStart(2, "0")} \`${track}\` ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}` })
                        .setFooter({ text: 'posted by ' + ytInfo.videoDetails.ownerChannelName })
                        .setImage(image && image.url);
                // console.log(embed)
                return { embeds: [embed], ephemeral: true, components: [buttons, buttons2] }
        } else {
                const embed = new EmbedBuilder()
                        .setTitle('music player')
                        .setDescription('no music in the player currently')
                        .setColor('#ff0000');
                return { embeds: [embed], ephemeral: true, components: [buttons, buttons2] }
        }
}

module.exports = {
        config: {
                setName: 'player',
                setDescription: 'shows the player and joins the vc'

        },
        async run(client, interaction, args) {
                try {
                        const channel = interaction.member.voice.channel
                        // console.log(channel)
                        channel.guild.resources = new Collection() || channel.guild.resources;

                        channel.guild.resources.set("connection", joinVoiceChannel({
                                channelId: channel.id,
                                guildId: channel.guild.id,
                                adapterCreator: channel.guild.voiceAdapterCreator,
                        }));

                        // await db.set(interaction.guildId, await db.get(interaction.guildId) || {});
                        const data = await db.get(interaction.guildId) || {}

                        data.player = { playlist: [], playlistPointer: 0, settings: { paused: false } }
                        await db.set(interaction.guildId, data)

                        reply = await showCurrntPlaying(interaction)
                        // console.log(reply)

                        interaction.reply(reply);
                        setInterval(async function() {
                                reply = await showCurrntPlaying(interaction)
                                // console.log(reply)

                                interaction.editReply(reply);
                        }, 10000);
                } catch (e) {
                        console.error(e)
                        interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
        },
        async button(client, interaction) {
                if (interaction.customId == "player_ADD") {
                        const modal = new ModalBuilder()
                                .setTitle("Add music to the playlist")
                                .setCustomId("player_ADD-URL")
                                .addComponents(
                                        new ActionRowBuilder().addComponents(
                                                new TextInputBuilder()
                                                        .setCustomId("player_URL-INPUT")
                                                        .setLabel("whats the url?")
                                                        .setPlaceholder("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
                                                        .setStyle(1)
                                        )
                                );

                        interaction.showModal(modal);
                } else if (interaction.customId == "player_CLEAR") {
                        const data = await db.get(interaction.guildId)
                        data.player.playlist = []
                        data.player.playlistPointer = 0
                        await db.set(interaction.guildId, data);
                } else if ((interaction.customId == "player_PAUSE" || interaction.customId == "player_PLAY")) {
                        const data = await db.get(interaction.guildId)
                        // console.log(data.player)

                        data.player.settings.paused = !data.player.settings.paused
                        await db.set(interaction.guildId, data);
                        interaction.update(await showCurrntPlaying(interaction));
                } else if (interaction.customId == "player_BEFORE") {
                        const data = await db.get(interaction.guildId)
                        // console.log(data.player)

                        data.player.playlistPointer = data.player.playlistPointer - 1
                        await db.set(interaction.guildId, data);
                        interaction.update(await showCurrntPlaying(interaction));
                } else if (interaction.customId == "player_NEXT") {
                        const data = await db.get(interaction.guildId)
                        // console.log(data.player.playlistPointer)

                        data.player.playlistPointer = data.player.playlistPointer + 1
                        await db.set(interaction.guildId, data);
                        interaction.update(await showCurrntPlaying(interaction));
                } else if (interaction.customId == "player_STOP") {
                        // console.log("STOP", interaction.member.voice.channel)
                        getVoiceConnection(interaction.member.voice.channel.guild.id).disconnect()
                        const embed = new EmbedBuilder()
                                .setTitle('music player')
                                .setDescription('left The channel')
                                .setColor('#000000');
                        interaction.update({ embed: [embed], ephemeral: true });
                } else console.log(interaction.customId);
        },
        async modal(client, interaction) {
                // console.log(interaction)
                if (interaction.customId == "player_ADD-URL") {
                        let url = interaction.fields.fields.get("player_URL-INPUT").value
                        try {
                                await ytdl.getInfo(url)
                                const data = await db.get(interaction.guildId)

                                data.player.playlist.push(url)
                                await db.set(interaction.guildId, data)
                                // interaction.reply({ content: 'added to the queue', ephemeral: true });
                                await interaction.deferUpdate();
                                tryStart(interaction)
                                interaction.editReply(await showCurrntPlaying(interaction));
                        } catch (e) {
                                // await interaction.deferUpdate();
                                // interaction.reply({ content: 'Not a youtube domain', ephemeral: true });
                        }
                } else if (interaction.customId == "player_CLEAR-MODAL") {
                        // console.log(interaction.fields)
                }
        },
        async select(client, interaction) {
                // console.log(interaction)
        }
}
