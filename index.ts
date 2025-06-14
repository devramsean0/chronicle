import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { App } from "@slack/bolt";
import type { GenericMessageEvent } from "@slack/types";
import { assigneesTable, ticketsTable } from './lib/schema';
import { buildMessageLink } from './lib/linkBuilder';
import { eq, sql } from 'drizzle-orm';
import { userDiffer } from './lib/userDiffer';
import type { PingCache } from './types/PingCache';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

// Blocks
import TicketManagementMessageBlock from './blocks/ticket-management-message.json'
import TicketAssignMembersBlock from './blocks/ticket-assign-members-block.json';
import AppHomeBlock from './blocks/app-home.json';
import AppHomeBlockedBlock from './blocks/app-home-blocked.json';

// Connect to DB
const db = drizzle(process.env.DATABASE_URL!);

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // add this
  appToken: process.env.SLACK_APP_TOKEN // add this
});

global.app = app;
global.db = db;


// Auto assignment queue
const redisConnection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null
});

const autoAssignQueue = new Queue('auto-assign', {
  connection: redisConnection
});

const autoAssignWorker = new Worker('auto-assign', async (job) => {
  const ticketId = job.data.ticketId;
  const db_ticket = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
  if (db_ticket[0]!.assignedTo.length > 0) {
    app.logger.info(`Ticket ${ticketId} already has assignees, skipping auto assignment.`);
    return;
  }

  const assignees = await db.select().from(assigneesTable).where(eq(assigneesTable.active, true));
  if (assignees.length === 0) {
    app.logger.info(`No active assignees found for auto assignment.`);
    return;
  }

  const randomAssignee = assignees[Math.floor(Math.random() * assignees.length)];
  await db.update(ticketsTable)
    .set({
      assignedTo: sql`array[${randomAssignee?.slackId!}]`
    })
    .where(eq(ticketsTable.id, ticketId));
  
  app.logger.info(`Ticket ${ticketId} auto assigned to ${randomAssignee?.slackId}`);
  await app.client.chat.postMessage({
    channel: process.env.LOG_CHANNEL_ID!,
    unfurl_links: true,
    text: `Ticket ${ticketId} has been auto assigned to <@${randomAssignee?.slackId}>.`,
  });
}, {
  connection: redisConnection,
  autorun: true
})

autoAssignWorker.on('completed', (job) => {
  app.logger.info(`Job ${job.id} completed successfully.`);
});
autoAssignWorker.on('failed', (job, err) => {
  app.logger.error(`Job ${job!.id} failed with error: ${err.message}`);
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
  });

  await autoAssignQueue.add('auto-assign', { ticketId: db_ticket[0]!.id}, {
    delay: 1000 * 60 * 120, // 2 hours
    attempts: 3, // Retry up to 3 times
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

  app.logger.info('Selected users:', selectedUsers.selected_users);

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

app.action("ticket-mark-closed", async ({ body, ack, client, logger }) => {
  await ack();

  if (body.type != "block_actions") return;

  const ticketId = body.message!.blocks![1]!.elements[0]!.value;

  const db_ticket = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);

  if (!db_ticket || db_ticket.length === 0) {
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: 'Ticket not found.',
    });
    return;
  }

  if (db_ticket[0]!.status === 1) {
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: 'This ticket is already closed.',
    });
    return;
  }

  await db.update(ticketsTable).set({
    status: 1 // Closed
  }).where(eq(ticketsTable.id, ticketId));

  await client.chat.postMessage({
    channel: process.env.LOG_CHANNEL_ID!,
    unfurl_links: true,
    text: `Marked ticket ${ticketId} as closed.`,
  })

  await client.chat.postMessage({
    channel: body.channel!.id,
    text: `Ticket ${ticketId} has been marked as closed.`,
    thread_ts: body.message!.ts,
  })
});

let pingCache: PingCache | null = null;

app.event("app_home_opened", async ({ event, client, logger }) => {
  try {
    // We want to limit this to FD members only, Done via the FD ping group. We also want to cache this for like a day.\
    if (!pingCache || (Date.now() - pingCache.fetchedOn) > 24 * 60 * 60 * 1000) {
      const pingGroup = await client.usergroups.users.list({
        usergroup: process.env.FD_PING_GROUP_ID!,
      });

      pingCache = {
        members: pingGroup.users || [],
        fetchedOn: Date.now(),
      };
    }

    const userId = event.user;
    if (!pingCache.members.includes(userId)) {
      await client.views.publish({
        user_id: userId,
        // @ts-expect-error
        view: AppHomeBlockedBlock
      })
      return;
    }

    const localAppHomeBlock = AppHomeBlock;

    const assignee_data = await db.insert(assigneesTable).values({
      slackId: event.user,
    }).onConflictDoNothing().returning();

    localAppHomeBlock.private_metadata = event.user;

    if (assignee_data[0]!.active) {
      localAppHomeBlock.blocks[1]!.text!.text = "You are currently in the automatic assignee pool.";
    } else {
      localAppHomeBlock.blocks[1]!.text!.text = "You are currently not in the automatic assignee pool. Click the button below to join.";
    }
    await client.views.publish({
      user_id: event.user,
      // @ts-expect-error
      view: AppHomeBlock
    });
  } catch (error) {
    logger.error('Error opening app home:', error);
    await client.chat.postEphemeral({
      channel: event.user,
      user: event.user,
      text: 'There was an error opening the app home. Please try again later.',
    });
  }
});

app.event("subteam_updated", async ({ event, client, logger }) => {
  try {
    if (event.subteam.id !== process.env.FD_PING_GROUP_ID) return;

    const current_assignees = await db.select().from(assigneesTable).where(eq(assigneesTable.active, true));
    const current_assignee_slack_ids = current_assignees.map(a => a.slackId);

    const new_possible_assignees = event.subteam.users || [];

    const diff = userDiffer(current_assignee_slack_ids, new_possible_assignees);

    if (diff.newUsers.length > 0) {
      await db.insert(assigneesTable).values(
        diff.newUsers.map(user => ({ slackId: user, active: true }))
      ).onConflictDoUpdate({
        target: [assigneesTable.slackId],
        set: { active: true }
      }).returning();
      logger.info('Assignee Created/Enabled:', diff.newUsers);
    }
    diff.removedUsers.forEach(async (user) => {
      await db.update(assigneesTable).set({ active: false }).where(eq(assigneesTable.slackId, user));
      logger.info('Assignee disabled:', user);
    })
  } catch (error) {
    logger.error('Error handling subteam update:', error);
    await client.chat.postEphemeral({
      channel: process.env.LOG_CHANNEL_ID!,
      user: process.env.LOG_CHANNEL_ID!,
      text: 'There was an error handling the subteam update. Please check the logs.',
    });
  }

  pingCache = null; // Invalidate cache to refresh on next app home open
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  app.logger.info('⚡️ Bolt app is running!');
})();