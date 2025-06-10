export function buildMessageLink(channelID: string, messageTS: string): string {
    return `https://hackclub.slack.com/archives/${channelID}/${messageTS}`;
}
