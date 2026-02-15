// packages/mobile/app/(tabs)/hubs/_layout.tsx
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Stack } from "expo-router";
import React from "react";

export default function HubsLayout() {
  const colorScheme = useColorScheme() ?? "light";
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
          title: "Content Hubs",
          headerShown: true,
        }}
      />

      <Stack.Screen
        name="new"
        options={{
          title: "Create New Hub",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="fill"
        options={{
          title: "Fill Hub",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
