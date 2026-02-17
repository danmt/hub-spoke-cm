// packages/mobile/app/(tabs)/agents/_layout.tsx
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";
import React from "react";

export default function AgentsLayout() {
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
          title: "Agent Registry",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          // Title is set dynamically in [id].tsx via Stack.Screen
          headerShown: true,
          headerBackTitle: "Back",
        }}
      />
    </Stack>
  );
}
