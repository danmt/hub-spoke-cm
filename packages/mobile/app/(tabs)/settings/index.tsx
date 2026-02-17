// packages/mobile/app/(tabs)/settings/index.tsx
import { SettingsMenu } from "@/components/settings/SettingsMenu";
import { View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useWorkspace } from "@/services/WorkspaceContext";
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  return (
    <View style={styles.container}>
      <SettingsMenu
        activeWorkspace={activeWorkspace}
        onNavigate={(path) => router.push(`/settings/${path}` as any)}
        themeColors={themeColors}
        colorScheme={colorScheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
  },
});
