import chalk from "chalk";
import inquirer from "inquirer";

export const cliRetryHandler = async (err: Error): Promise<boolean> => {
  console.log(chalk.red(`\n⚠️  AI Request Error: ${err.message}`));
  const { retry } = await inquirer.prompt([
    {
      type: "confirm",
      name: "retry",
      message: "Would you like to retry the request?",
      default: true,
    },
  ]);
  return retry;
};
