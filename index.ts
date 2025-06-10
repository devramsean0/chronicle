import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";

import { App } from "@slack/bolt";
import type { GenericMessageEvent } from "@slack/types";
import { ticketsTable } from './schema';
import { buildMessageLink } from './lib/linkBuilder';

// Blocks
import TicketManagementMessageBlock from './blocks/ticket-management-message.json'
import TicketAssignMembersBlock from './blocks/ticket-assign-members-block.json';
import { eq } from 'drizzle-orm';
import { userDiffer } from './lib/userDiffer';

// Connect to DB
const db = drizzle(process.env.DATABASE_URL!);

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // add this
  appToken: process.env.SLACK_APP_TOKEN // add this
});



app.message(async ({ message, say, client, logger }) => {
  if (message.subtype) {
    return;
  }

  const msg = message as GenericMessageEvent;
  if (msg.channel != process.env.FIREHOUSE_CHANNEL_ID!) return;

  if (msg.thread_ts) return;
  if (!msg.text) return;

  logger.info('New message received in firehouse:', {
    channel: msg.channel,
    user: msg.user,
    text: msg.text,
    timestamp: msg.ts
  });
  const db_ticket = await db.insert(ticketsTable).values({
    originalMessageTS: msg.ts,
  }).returning();

  // Send a message to log channel
  client.chat.postMessage({
    channel: process.env.LOG_CHANNEL_ID!,
    unfurl_links: true,
    text: `New ticket created!\n${buildMessageLink(msg.channel, msg.ts)}\nTicket ID: ${db_ticket[0]?.id}`,
  })

  const localTicketManagementMessageBlock = TicketManagementMessageBlock
  localTicketManagementMessageBlock[1]!.elements?.map((element) => {
    element.value = db_ticket[0]!.id;
    return element;
  });
  // Reply with message to manage assignees
  await say({
    //text: `You can manage this ticket by using the buttons here :)`,
    thread_ts: msg.ts,
    blocks: localTicketManagementMessageBlock!,
  })
});

app.action("ticket-assign-manager", async ({ body, ack, client, logger }) => {
  await ack();

  if (body.type != "block_actions") return;

  const ticketId = body.message!.blocks![1]!.elements[0]!.value;

  const db_ticket = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);

  const localTicketAssignMembersBlock = TicketAssignMembersBlock;
  localTicketAssignMembersBlock.private_metadata = ticketId
  // @ts-expect-error - omg I hate this, but it kinda works? (ssh, don't tell the type checker)
  localTicketAssignMembersBlock.blocks[2]!.element!.initial_users = db_ticket[0]?.assignedTo || [];
  
  try {
    const result = await client.views.open({
      trigger_id: body.trigger_id,
      // @ts-expect-error
      view: localTicketAssignMembersBlock,
      
    })
  } catch (error) {
    logger.error('Error opening view:', error);
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: 'There was an error opening the ticket management view. Please try again later.',
    });
  }
});

app.view({ callback_id: "ticket-assign-members-modal", type: "view_submission"}, async ({ ack, body, view, client, logger }) => {
  await ack();
  const selectedUsers = view.state.values["assignees-select-block"]!["assignees-select"] || {
    selected_users: []
  };


  if ((selectedUsers.selected_users ?? []).length > 2) {
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: 'You can only assign up to 2 users to a ticket.',
    })
    return;
  }

  console.log('Selected users:', selectedUsers.selected_users);

  const db_ticket = await db.select().from(ticketsTable).where(eq(ticketsTable.id, view.private_metadata)).limit(1);

  await db.update(ticketsTable)
    .set({
      assignedTo: selectedUsers.selected_users })
    .where(eq(ticketsTable.id, view.private_metadata))

  const user_difference = userDiffer(db_ticket[0]?.assignedTo ?? [], selectedUsers.selected_users ?? []);

  user_difference.newUsers.forEach(async (user) => {
    await client.chat.postMessage({
      channel: process.env.LOG_CHANNEL_ID!,
      unfurl_links: true,
      text: `Assigned <@${user}> to ${db_ticket[0]?.id}`,
    })
  });
  user_difference.removedUsers.forEach(async (user) => {
    await client.chat.postMessage({
      channel: process.env.LOG_CHANNEL_ID!,
      unfurl_links: true,
      text: `Removed <@${user}> from ${db_ticket[0]?.id}`,
    })
  });
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  app.logger.info('⚡️ Bolt app is running!');
})();