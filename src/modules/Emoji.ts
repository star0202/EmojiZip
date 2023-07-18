import EmojiSelect from '../structures/components/EmojiSelect'
import ZipConfirm from '../structures/components/ZipConfirm'
import { clean } from '../utils/clean'
import { download } from '../utils/download'
import { createComponentFilter } from '../utils/filter'
import { unzip, zip } from '../utils/zip'
import { Extension, applicationCommand, option } from '@pikokr/command.ts'
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  ComponentType,
} from 'discord.js'
import { readFileSync } from 'fs'
import { parse } from 'path'

export class Emoji extends Extension {
  @applicationCommand({
    type: ApplicationCommandType.ChatInput,
    name: 'zip',
    description: 'Zip emoji',
  })
  async zip(i: ChatInputCommandInteraction) {
    if (!i.guild) return i.reply('❌ This command is only available in guilds')

    await i.deferReply()

    const emojis = await i.guild.emojis.fetch()

    if (!emojis) return i.editReply('❌ No emojis found')

    const response = await i.editReply({
      content: '⏳ Select emojis to zip',
      components: [new EmojiSelect(emojis), new ZipConfirm()],
    })

    let selected: EmojiType[] = emojis.map((e) => ({
      name: e.name ?? 'unknown',
      url: e.url,
    }))

    response
      .createMessageComponentCollector({
        filter: createComponentFilter(i),
        componentType: ComponentType.StringSelect,
        time: 30 * 1000,
      })
      .on('collect', async (j) => {
        await j.deferUpdate()

        selected = j.values.map((v) => {
          const [name, url] = v.split(' ')
          return { name, url }
        })
      })
      .on('end', async () => {
        await i.editReply({ content: '❌ Timeout', components: [] })
      })

    response
      .createMessageComponentCollector({
        filter: createComponentFilter(i),
        componentType: ComponentType.Button,
      })
      .on('collect', async (j) => {
        switch (j.customId) {
          case 'zip': {
            await j.deferUpdate()

            await i.editReply({
              content: '⏳ Zipping...',
              components: [],
            })

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const path = await zip(selected, i.guild!.id)

            await i.editReply({
              content: `✅ ${selected.length} emojis zipped`,
              files: [path],
              components: [],
            })

            clean()

            break
          }

          case 'cancel':
            await j.deferUpdate()

            await i.editReply({
              content: '❌ Canceled',
              components: [],
            })

            break
        }
      })
  }

  @applicationCommand({
    type: ApplicationCommandType.ChatInput,
    name: 'upload',
    description: 'Upload emoji',
  })
  async upload(
    i: ChatInputCommandInteraction,
    @option({
      type: ApplicationCommandOptionType.Attachment,
      name: 'file',
      description: 'Emoji zip file',
      required: true,
    })
    _: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ) {
    if (!i.guild) return i.reply('❌ This command is only available in guilds')

    await i.deferReply()

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const path = await download(i.options.getAttachment('file')!.url)

    const files = await unzip(path)

    try {
      for (const file of files) {
        await i.guild.emojis.create({
          name: parse(file).name,
          attachment: readFileSync(file),
        })
      }
    } catch (e) {
      return i.editReply('❌ Failed to upload emoji (likely due to permission)')
    }

    await i.editReply('✅ Done')

    clean()
  }
}

export const setup = async () => new Emoji()
