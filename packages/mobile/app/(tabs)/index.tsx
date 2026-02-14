// packages/mobile/app/(tabs)/index.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useWorkspace } from "@/services/WorkspaceContext";
import { useNavigation } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

export default function HomeScreen() {
  const { activeWorkspace, isLoading } = useWorkspace();
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const navigation = useNavigation() as any;

  if (isLoading) return null;

  if (!activeWorkspace) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No Active Workspace</Text>
        <View
          style={styles.separator}
          lightColor="#eee"
          darkColor="rgba(255,255,255,0.1)"
        />
        <Text style={styles.emptyText}>
          You need to select or create a workspace before you can manage
          content.
        </Text>
        <Pressable
          style={[styles.linkButton, { marginTop: 20 }]}
          onPress={() => navigation.navigate("settings")}
        >
          <Text style={{ color: themeColors.tint, fontWeight: "600" }}>
            Go to Workspace Settings →
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Content Hubs</Text>
        <Text
          style={[
            styles.badge,
            {
              backgroundColor: themeColors.buttonPrimary + "20",
              color: themeColors.buttonPrimary,
            },
          ]}
        >
          {activeWorkspace}
        </Text>
      </View>
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <Text style={styles.emptyText}>
        No hubs found in the{" "}
        <Text style={{ fontWeight: "bold" }}>{activeWorkspace}</Text> workspace.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 10,
    overflow: "hidden",
  },
  title: { fontSize: 24, fontWeight: "bold" },
  separator: { marginVertical: 20, height: 1, width: "100%" },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  linkButton: { padding: 10, backgroundColor: "transparent" },
});
