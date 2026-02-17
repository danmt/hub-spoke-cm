import { File, Paths } from "expo-file-system";

/**
 * Handles mobile-only persistence for the active workspace.
 * This keeps the @hub-spoke/core config clean.
 */
export class WorkspaceStorage {
  private static stateFile = new File(Paths.document, "mobile_state.json");

  static async getActiveWorkspace(): Promise<string | undefined> {
    if (!this.stateFile.exists) return undefined;
    try {
      const data = JSON.parse(await this.stateFile.text());
      return data.activeWorkspace;
    } catch {
      return undefined;
    }
  }

  static async setActiveWorkspace(id: string | undefined): Promise<void> {
    const currentState = this.stateFile.exists
      ? JSON.parse(await this.stateFile.text())
      : {};

    this.stateFile.write(
      JSON.stringify(
        {
          ...currentState,
          activeWorkspace: id,
        },
        null,
        2,
      ),
    );
  }
}
