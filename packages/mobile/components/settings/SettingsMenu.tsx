import { ThemeColors } from "@/constants/Colors";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text, View } from "../Themed";

interface MenuItemProps {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
  themeColors: ThemeColors;
  colorScheme: "light" | "dark";
}

function SettingsMenuItem({
  icon,
  title,
  subtitle,
  onPress,
  themeColors,
  colorScheme,
}: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: colorScheme === "dark" ? "#333" : "#eee" },
          ]}
        >
          <FontAwesome name={icon} size={18} color={themeColors.text} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.menuItemText}>{title}</Text>
          {subtitle && <Text style={styles.menuItemSubtext}>{subtitle}</Text>}
        </View>
      </View>
      <FontAwesome name="chevron-right" size={14} color="#888" />
    </Pressable>
  );
}

interface MenuProps {
  activeWorkspace?: string;
  onNavigate: (view: "workspaces" | "secrets" | "config") => void;
  themeColors: ThemeColors;
  colorScheme: "light" | "dark";
}

export function SettingsMenu({
  activeWorkspace,
  onNavigate,
  themeColors,
  colorScheme,
}: MenuProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <SettingsMenuItem
        icon="folder"
        title="Active Workspace"
        subtitle={activeWorkspace || "None Selected"}
        onPress={() => onNavigate("workspaces")}
        themeColors={themeColors}
        colorScheme={colorScheme}
      />

      <SettingsMenuItem
        icon="lock"
        title="Secrets & API Keys"
        onPress={() => onNavigate("secrets")}
        themeColors={themeColors}
        colorScheme={colorScheme}
      />

      <SettingsMenuItem
        icon="sliders"
        title="Global Configuration"
        onPress={() => onNavigate("config")}
        themeColors={themeColors}
        colorScheme={colorScheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  title: { fontSize: 34, fontWeight: "bold", marginBottom: 30 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    backgroundColor: "transparent",
  },
  pressed: { opacity: 0.7 },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: { marginLeft: 15 },
  menuItemText: { fontSize: 17, fontWeight: "500" },
  menuItemSubtext: { fontSize: 12, color: "#888", marginTop: 2 },
});
