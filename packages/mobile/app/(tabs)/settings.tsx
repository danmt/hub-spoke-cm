import { ConfigSettings } from "@/components/settings/ConfigSettings";
import { SecretSettings } from "@/components/settings/SecretSettings";
import { SettingsMenu } from "@/components/settings/SettingsMenu";
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings";
import { Text, View } from "@/components/Themed"; // Ensure Text is imported from Themed
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { WorkspaceStorage } from "@/services/WorkspaceStorage";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ConfigService, SecretService } from "@hub-spoke/core";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

type SettingsView = "menu" | "secrets" | "config" | "workspaces";

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const [view, setView] = useState<SettingsView>("menu");

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [activeWorkspace, setActiveWorkspace] = useState<string | undefined>();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const secret = await SecretService.getSecret();
      const config = await ConfigService.getConfig();
      const activeWs = await WorkspaceStorage.getActiveWorkspace();

      setApiKey(secret.apiKey || "");
      setModel(config.model || "gemini-2.0-flash");
      setActiveWorkspace(activeWs);
      setWorkspaces(WorkspaceManager.listWorkspaces());
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return null;

  // Title Mapping for sub-sections
  const headerTitles: Record<Exclude<SettingsView, "menu">, string> = {
    workspaces: "Workspaces",
    secrets: "Secrets",
    config: "Configuration",
  };

  const renderHeader = (title: string) => (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => setView("menu")}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <FontAwesome name="chevron-left" size={18} color={themeColors.tint} />
      </Pressable>
      <Text style={[styles.viewTitle, { color: themeColors.text }]}>
        {title}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {view === "menu" ? (
        <SettingsMenu
          activeWorkspace={activeWorkspace}
          onNavigate={setView}
          themeColors={themeColors}
          colorScheme={colorScheme}
        />
      ) : (
        <>
          {renderHeader(headerTitles[view as keyof typeof headerTitles])}

          {view === "workspaces" && (
            <WorkspaceSettings
              activeWorkspace={activeWorkspace}
              workspaces={workspaces}
              onRefresh={loadData}
              themeColors={themeColors}
            />
          )}

          {view === "secrets" && (
            <SecretSettings
              apiKey={apiKey}
              setApiKey={setApiKey}
              themeColors={themeColors}
              colorScheme={colorScheme}
            />
          )}

          {view === "config" && (
            <ConfigSettings
              model={model}
              setModel={setModel}
              themeColors={themeColors}
              colorScheme={colorScheme}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
  },
  viewTitle: {
    fontSize: 22,
    fontWeight: "bold",
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
    backgroundColor: "transparent",
  },
  backButton: {
    marginRight: 15,
    paddingVertical: 8,
    paddingRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
