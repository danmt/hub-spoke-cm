import chalk from "chalk";
import { Command } from "commander";
import { getGlobalConfig, setGlobalConfig } from "../../utils/config.js";

export const configCommand = new Command("config")
  .description("Manage global configuration (e.g., API keys)")
  .argument("<key>", "Your Gemini API Key")
  .action((key) => {
    try {
      setGlobalConfig("apiKey", key);
      console.log(chalk.green("\n✅ API Key saved globally!"));
      console.log(
        chalk.white(
          "You can now run hub commands in any directory without a .env file.",
        ),
      );
    } catch (error) {
      console.error(chalk.red("Failed to save config:"), error);
    }
  });

// Optional: Add a 'show' command to verify
configCommand.parent?.addCommand(
  new Command("show").action(() => {
    const config = getGlobalConfig();
    if (config.apiKey) {
      console.log(`API Key: ${config.apiKey.substring(0, 5)}...`);
    } else {
      console.log("No API Key set.");
    }
  }),
);
