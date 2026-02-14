import { ConfigManager } from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import { ConfigStorage } from "../services/ConfigStorage.js";

const configCommand = new Command("config").description(
  "Manage global configuration (API keys, Models)",
);

configCommand
  .command("list")
  .description("Show current configuration")
  .action(async () => {
    const config = await ConfigStorage.load();
    const storagePath = ConfigStorage.getStoragePath();

    console.log(chalk.blue("\n⚙️  Global Configuration:"));
    console.log(chalk.gray(`   (${storagePath})\n`));

    // Mask API Key for security
    const maskedKey = config.apiKey
      ? `${config.apiKey.substring(0, 4)}...${config.apiKey.substring(config.apiKey.length - 4)}`
      : chalk.red("(Not Set)");

    console.log(`   ${chalk.bold("API Key:")}         ${maskedKey}`);
    console.log(
      `   ${chalk.bold("Default Model:")} ${chalk.green(config.model || "gemini-2.0-flash")}`,
    );
    console.log("");
  });

configCommand
  .command("set-key <key>")
  .description("Set your Google Gemini API Key")
  .action(async (key) => {
    const current = await ConfigStorage.load();
    // Validate changes through Core logic
    const updated = ConfigManager.prepareUpdate(current, { apiKey: key });
    await ConfigStorage.save(updated);
    console.log(chalk.green("\n✅ API Key saved successfully."));
  });

configCommand
  .command("set-model <modelName>")
  .description("Set the default model to be used")
  .action(async (modelName) => {
    const current = await ConfigStorage.load();
    const updated = ConfigManager.prepareUpdate(current, {
      model: modelName,
    });
    await ConfigStorage.save(updated);
    console.log(chalk.green(`\n✅ Model set to: ${modelName}`));
  });

export { configCommand };
