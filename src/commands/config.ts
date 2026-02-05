import chalk from "chalk";
import { Command } from "commander";
import { getGlobalConfig, setGlobalConfig } from "../utils/config.js";

const configCommand = new Command("config").description(
  "Manage global configuration (API keys, Models)",
);

configCommand
  .command("list")
  .description("Show current configuration")
  .action(() => {
    const config = getGlobalConfig();
    console.log(chalk.blue("\n⚙️  Global Configuration:"));
    console.log(chalk.gray("   (~/.config/hub-spoke-cm/config.json)\n"));

    // Mask API Key for security
    const maskedKey = config.apiKey
      ? `${config.apiKey.substring(0, 4)}...${config.apiKey.substring(config.apiKey.length - 4)}`
      : chalk.red("(Not Set)");

    console.log(`   ${chalk.bold("API Key:")}         ${maskedKey}`);
    console.log(
      `   ${chalk.bold("Architect Model:")} ${chalk.green(config.architectModel)}`,
    );
    console.log(
      `   ${chalk.bold("Writer Model:")}    ${chalk.green(config.writerModel)}`,
    );
    console.log("");
  });

configCommand
  .command("set-key <key>")
  .description("Set your Google Gemini API Key")
  .action((key) => {
    setGlobalConfig({ apiKey: key });
    console.log(chalk.green("\n✅ API Key saved successfully."));
  });

configCommand
  .command("set-model-architect <modelName>")
  .description(
    "Set the model used for planning structure (e.g. gemini-1.5-pro)",
  )
  .action((modelName) => {
    setGlobalConfig({ architectModel: modelName });
    console.log(chalk.green(`\n✅ Architect model set to: ${modelName}`));
  });

configCommand
  .command("set-model-writer <modelName>")
  .description("Set the model used for writing prose (e.g. gemini-1.5-flash)")
  .action((modelName) => {
    setGlobalConfig({ writerModel: modelName });
    console.log(chalk.green(`\n✅ Writer model set to: ${modelName}`));
  });

export { configCommand };
