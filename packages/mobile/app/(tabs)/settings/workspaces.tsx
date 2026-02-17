// packages/mobile/app/(tabs)/settings/workspaces.tsx
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings";
import { View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { WorkspaceStorage } from "@/services/WorkspaceStorage";
import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

export default function WorkspacesScreen() {
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];
  const [activeWorkspace, setActiveWorkspace] = useState<string | undefined>();
  const [workspaces, setWorkspaces] = useState<string[]>([]);

  const loadData = async () => {
    const activeWorkspace = await WorkspaceStorage.getActiveWorkspace();
    setActiveWorkspace(activeWorkspace);
    setWorkspaces(WorkspaceManager.listWorkspaces());
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={styles.container}>
      <WorkspaceSettings
        activeWorkspace={activeWorkspace}
        workspaces={workspaces}
        onRefresh={loadData}
        themeColors={themeColors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
});
