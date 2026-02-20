import { RegistryProvider } from "@hub-spoke/core";
import { Directory, File, Paths } from "expo-file-system";

export class MobileRegistryProvider implements RegistryProvider {
  /**
   * @param workspaceRoot - The absolute URI of the active workspace.
   */
  constructor(private workspaceRoot: string = Paths.document.uri) {}

  /**
   * Scans agent category folders (e.g., /personas) for agent subdirectories.
   * Returns an array of folder names which serve as the internal IDs.
   */
  async listAgentFolders(folder: string): Promise<string[]> {
    const categoryDir = new Directory(this.workspaceRoot, "agents", folder);

    if (!categoryDir.exists) {
      return [];
    }

    const contents = categoryDir.list();

    // Filter for directories only; each directory represents one adaptive agent package
    return contents
      .filter((item): item is Directory => item instanceof Directory)
      .map((item) => item.name);
  }

  /**
   * Reads the specific artifacts from an agent's directory package.
   * Core requires the raw strings to perform schema validation and parsing.
   */
  async readAgentPackage(
    folder: string,
    folderName: string,
  ): Promise<{
    identity: string;
    behavior: string;
    knowledge: string;
  }> {
    const agentDir = new Directory(
      this.workspaceRoot,
      "agents",
      folder,
      folderName,
    );

    if (!agentDir.exists) {
      throw new Error(
        `Agent package not found at: agents/${folder}/${folderName}`,
      );
    }

    // Required artifacts for registry synchronization
    const identityFile = new File(agentDir, "agent.json");
    const behaviorFile = new File(agentDir, "behavior.md");
    const knowledgeFile = new File(agentDir, "knowledge.json");

    // Ensure critical files exist before attempting to read
    if (!identityFile.exists || !behaviorFile.exists || !knowledgeFile.exists) {
      throw new Error(
        `Incomplete agent package detected in ${folderName}. Missing core artifacts.`,
      );
    }

    return {
      identity: await identityFile.text(),
      behavior: await behaviorFile.text(),
      knowledge: await knowledgeFile.text(),
    };
  }

  /**
   * Gets the identifier (filename without extension).
   * Used as the Agent ID if 'id' is missing in the frontmatter.
   */
  getIdentifier(file: string): string {
    const fileObj = new File(file);
    // Standard Node-like behavior: "tutorial.md" -> "tutorial"
    return fileObj.name.replace(/\.[^/.]+$/, "");
  }

  setWorkspaceRoot(path: string): void {
    this.workspaceRoot = path;
  }
}
