// packages/cli/src/commands/config.ts
import { ConfigService, SecretService } from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";

const configCommand = new Command("config").description(
  "Manage global configuration (API keys, Models)",
);

configCommand
  .command("list")
  .description("Show current configuration")
  .action(async () => {
    const config = await ConfigService.getConfig();
    const secret = await SecretService.getSecret();

    console.log(chalk.blue("\n⚙️  Global Configuration:"));
    console.log(chalk.gray(`   (${ConfigService.getStorageInfo()})`));

    console.log(chalk.blue("🤫  Secrets Configuration:"));
    console.log(chalk.gray(`   (${SecretService.getStorageInfo()})\n`));

    const maskedKey = secret.apiKey
      ? `${secret.apiKey.substring(0, 4)}...${secret.apiKey.substring(secret.apiKey.length - 4)}`
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
    await SecretService.updateSecret({ apiKey: key });
    console.log(chalk.green("\n✅ API Key saved successfully."));
  });

configCommand
  .command("set-model <modelName>")
  .description("Set the default model to be used")
  .action(async (modelName) => {
    await ConfigService.updateConfig({
      model: modelName,
    });
    console.log(chalk.green(`\n✅ Model set to: ${modelName}`));
  });

export { configCommand };
