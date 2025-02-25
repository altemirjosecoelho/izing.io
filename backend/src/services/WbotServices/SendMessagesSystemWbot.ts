/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { join } from "path";
import { Buttons, Client, List, MessageMedia } from "whatsapp-web.js";
import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { sleepRandomTime } from "../../utils/sleepRandomTime";
import Contact from "../../models/Contact";
// import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

interface Session extends Client {
  id?: number;
}

const SendMessagesSystemWbot = async (
  wbot: Session,
  tenantId: number | string
): Promise<void> => {
  const messages = await Message.findAll({
    where: {
      fromMe: true,
      messageId: { [Op.is]: null },
      status: "pending",
      [Op.or]: [
        {
          scheduleDate: {
            [Op.lte]: new Date()
          }
        },
        {
          scheduleDate: { [Op.is]: null }
        }
      ]
    },
    include: [
      {
        model: Contact,
        as: "contact",
        where: {
          tenantId,
          number: {
            [Op.notIn]: ["", "null"]
          }
        }
      },
      {
        model: Ticket,
        as: "ticket",
        where: {
          tenantId,
          status: { [Op.ne]: "closed" },
          channel: "whatsapp"
        },
        include: ["contact"]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ],
    order: [["createdAt", "ASC"]]
  });
  let sendedMessage;

  // logger.info(
  //   `SystemWbot SendMessages | Count: ${messages.length} | Tenant: ${tenantId} `
  // );

  for (const message of messages) {
    let quotedMsgSerializedId: string | undefined;
    const { ticket } = message;
    const contactNumber = ticket.contact.number;
    const typeGroup = ticket?.isGroup ? "g" : "c";
    const chatId = `${contactNumber}@${typeGroup}.us`;

    if (message.quotedMsg) {
      quotedMsgSerializedId = `${message.quotedMsg.fromMe}_${contactNumber}@${typeGroup}.us_${message.quotedMsg.messageId}`;
    }

    try {
      if (message.mediaType !== "chat" && message.mediaName) {
        const customPath = join(__dirname, "..", "..", "..", "public");
        const mediaPath = join(customPath, message.mediaName);
        const newMedia = MessageMedia.fromFilePath(mediaPath);
        sendedMessage = await wbot.sendMessage(chatId, newMedia, {
          quotedMessageId: quotedMsgSerializedId,
          linkPreview: false, // fix: send a message takes 2 seconds when there's a link on message body
          sendAudioAsVoice: true
        });
        logger.info("sendMessage media");
      } else {
        const btn = new Buttons(
          "Button body",
          [{ body: "bt1" }, { body: "bt2" }, { body: "bt3" }],
          "title",
          "footer"
        );
        const sections = [
          {
            title: "sectionTitle",
            rows: [
              { title: "ListItem1", description: "desc" },
              { title: "ListItem2" }
            ]
          }
        ];
        // const list = new List(
        //   "List body",
        //   "btnText",
        //   sections,
        //   "Title",
        //   "footer"
        // );
        // await wbot.sendMessage(chatId, list);
        await wbot.sendMessage(chatId, btn);
        sendedMessage = await wbot.sendMessage(chatId, message.body, {
          quotedMessageId: quotedMsgSerializedId,
          linkPreview: false // fix: send a message takes 2 seconds when there's a link on message body
        });
        logger.info("sendMessage text");
      }

      // enviar old_id para substituir no front a mensagem corretamente
      const messageToUpdate = {
        ...message,
        ...sendedMessage,
        id: message.id,
        messageId: sendedMessage.id.id,
        status: "sended"
      };

      await Message.update(
        { ...messageToUpdate },
        { where: { id: message.id } }
      );

      logger.info("Message Update");
      // await SetTicketMessagesAsRead(ticket);

      // delay para processamento da mensagem
      await sleepRandomTime({
        minMilliseconds: Number(process.env.MIN_SLEEP_INTERVAL || 500),
        maxMilliseconds: Number(process.env.MAX_SLEEP_INTERVAL || 2000)
      });

      logger.info("sendMessage", sendedMessage.id.id);
    } catch (error) {
      const idMessage = message.id;
      const ticketId = message.ticket.id;

      if (error.code === "ENOENT") {
        await Message.destroy({
          where: { id: message.id }
        });
      }

      logger.error(
        `Error message is (tenant: ${tenantId} | Ticket: ${ticketId})`
      );
      logger.error(`Error send message (id: ${idMessage})::${error}`);
    }
  }
};

export default SendMessagesSystemWbot;
