import chalk from "chalk";
import inquirer from "inquirer";

export type InteractionResponse =
  | {
      action: "proceed";
    }
  | {
      action: "feedback";
      feedback: string;
    };

export async function cliConfirmOrFeedback(): Promise<InteractionResponse> {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Action:",
      choices: [
        { name: "🚀 Proceed", value: "proceed" },
        { name: "💬 Feedback", value: "feedback" },
      ],
    },
  ]);

  if (action === "proceed") return { action: "proceed" };

  const { feedback } = await inquirer.prompt([
    {
      type: "input",
      name: "feedback",
      message: chalk.cyan("You:"),
      validate: (v: string) => v.length > 0 || "Feedback cannot be empty.",
    },
  ]);

  return { action: "feedback", feedback };
}
