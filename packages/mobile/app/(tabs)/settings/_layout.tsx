// packages/mobile/app/(tabs)/settings/_layout.tsx
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";

export default function SettingsLayout() {
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.background,
        },
        headerTintColor: themeColors.tint,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Settings",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="workspaces"
        options={{
          title: "Workspaces",
          headerTitle: "Manage Workspaces",
        }}
      />
      <Stack.Screen
        name="secrets"
        options={{
          title: "Secrets",
          headerTitle: "API Keys",
        }}
      />
      <Stack.Screen
        name="config"
        options={{
          title: "Configuration",
          headerTitle: "Global Config",
        }}
      />
    </Stack>
  );
}
