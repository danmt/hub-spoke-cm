// packages/mobile/services/ExportService.ts
import { IoService, LoggerService, ParserService } from "@hub-spoke/core";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export class ExportService {
  /**
   * Reads a hub, cleans it, writes a temporary file, and opens the native OS share sheet.
   * This handles Telegram, Email, Files, and other standard sharing targets.
   * * @param hubRootDir - The absolute URI of the hub directory (e.g., file:///.../posts/my-hub)
   */
  static async exportHub(hubRootDir: string) {
    if (!hubRootDir) {
      await LoggerService.error("ExportService: hubRootDir is required.");
      return;
    }

    try {
      await LoggerService.info("ExportService: Initiating hub export", {
        hubRootDir,
      });

      // 1. Read the hub through the core IoService (using MobileIoProvider)
      const hubFile = await IoService.readHubFile(hubRootDir);

      // 2. Clean the markdown content using the core ParserService
      const { frontmatter, content: cleanMarkdown } =
        ParserService.stripInternalMetadata(hubFile);

      // 3. Prepare the temporary file in the cache directory
      // Using Paths.cache ensures the OS can clean this up later
      const fileName = `${frontmatter.hubId || "exported-hub"}.md`;
      const tempFile = new File(Paths.cache, fileName);

      // 4. Ensure file exists and overwrite with clean content
      if (!tempFile.exists) {
        tempFile.create();
      }

      tempFile.write(cleanMarkdown);

      // 5. Trigger native share sheet
      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (isSharingAvailable) {
        await Sharing.shareAsync(tempFile.uri, {
          mimeType: "text/markdown",
          dialogTitle: `Export: ${frontmatter.title}`,
          UTI: "net.daringfireball.markdown", // Universal Type Identifier for Markdown on iOS
        });

        await LoggerService.info(
          "ExportService: Share sheet opened successfully.",
        );
      } else {
        throw new Error("Sharing is not supported on this device.");
      }
    } catch (error: any) {
      await LoggerService.error("ExportService: Export failed", {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
