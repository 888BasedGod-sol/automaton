#!/usr/bin/env node
/**
 * Conway Automagotchi CLI
 *
 * Creator-facing CLI for interacting with an automagotchi.
 * Usage: automagotchi-cli <command> [args]
 */

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  switch (command) {
    case "status":
      await import("./commands/status.js");
      break;
    case "logs":
      await import("./commands/logs.js");
      break;
    case "fund":
      await import("./commands/fund.js");
      break;
    case "send":
      await import("./commands/send.js");
      break;
    default:
      console.log(`
Conway Automagotchi CLI - Creator Tools

Usage:
  automagotchi-cli status              Show automagotchi status
  automagotchi-cli logs [--tail N]     View automagotchi logs
  automagotchi-cli fund <amount> [--to 0x...]  Transfer Conway credits
  automagotchi-cli send <to-address> <message> Send a social message
`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
