// packages/mobile/app/(tabs)/settings.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ConfigService, SecretService } from "@hub-spoke/core";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";

type SettingsView = "menu" | "secrets" | "config";

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const [view, setView] = useState<SettingsView>("menu");

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const secret = await SecretService.getSecret();
        const config = await ConfigService.getConfig();
        if (secret.apiKey) setApiKey(secret.apiKey);
        if (config.model) setModel(config.model);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleUpdateApiKey = async () => {
    try {
      await SecretService.updateSecret({ apiKey });
      Alert.alert("Success", "Gemini API Key updated.");
    } catch (e) {
      Alert.alert("Error", "Failed to update API Key.");
    }
  };

  const handleUpdateConfig = async () => {
    try {
      await ConfigService.updateConfig({ model });
      Alert.alert("Success", "Configuration updated.");
    } catch (e) {
      Alert.alert("Error", "Failed to update configuration.");
    }
  };

  if (isLoading) return null;

  const renderHeader = (title: string) => (
    <View style={styles.headerRow}>
      <Pressable onPress={() => setView("menu")} style={styles.backButton}>
        <FontAwesome
          name="chevron-left"
          size={18}
          color={themeColors.tint}
          aria-label="Back to settings menu"
        />
      </Pressable>
      <Text style={styles.viewTitle}>{title}</Text>
    </View>
  );

  if (view === "menu") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          onPress={() => setView("secrets")}
        >
          <View style={styles.menuItemLeft}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colorScheme === "dark" ? "#333" : "#eee" },
              ]}
            >
              <FontAwesome name="lock" size={18} color={themeColors.text} />
            </View>
            <Text style={styles.menuItemText}>Secrets & API Keys</Text>
          </View>
          <FontAwesome name="chevron-right" size={14} color="#888" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          onPress={() => setView("config")}
        >
          <View style={styles.menuItemLeft}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colorScheme === "dark" ? "#333" : "#eee" },
              ]}
            >
              <FontAwesome name="sliders" size={18} color={themeColors.text} />
            </View>
            <Text style={styles.menuItemText}>Global Configuration</Text>
          </View>
          <FontAwesome name="chevron-right" size={14} color="#888" />
        </Pressable>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Environment Storage</Text>
          <Text style={styles.infoText}>{SecretService.getStorageInfo()}</Text>
        </View>
      </View>
    );
  }

  if (view === "secrets") {
    return (
      <ScrollView style={styles.container}>
        {renderHeader("Secrets")}
        <View
          style={[
            styles.card,
            { backgroundColor: colorScheme === "dark" ? "#1a1a1a" : "#f2f2f2" },
          ]}
        >
          <Text style={styles.label}>Gemini API Key</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.text,
                borderColor: themeColors.tint,
                backgroundColor: colorScheme === "dark" ? "#000" : "#fff",
              },
            ]}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="Enter API Key"
            placeholderTextColor="#888"
            secureTextEntry
          />
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: themeColors.buttonPrimary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={handleUpdateApiKey}
          >
            <Text style={styles.buttonTextBold}>Update Key</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (view === "config") {
    return (
      <ScrollView style={styles.container}>
        {renderHeader("Configuration")}
        <View
          style={[
            styles.card,
            { backgroundColor: colorScheme === "dark" ? "#1a1a1a" : "#f2f2f2" },
          ]}
        >
          <Text style={styles.label}>Default AI Model</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.text,
                borderColor: themeColors.tint,
                backgroundColor: colorScheme === "dark" ? "#000" : "#fff",
              },
            ]}
            value={model}
            onChangeText={setModel}
            placeholder="e.g. gemini-2.0-flash"
            placeholderTextColor="#888"
          />
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: themeColors.buttonPrimary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={handleUpdateConfig}
          >
            <Text style={styles.buttonTextBold}>Save Changes</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
  },
  title: { fontSize: 34, fontWeight: "bold", marginBottom: 30 },
  viewTitle: { fontSize: 22, fontWeight: "bold" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
    backgroundColor: "transparent",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
    padding: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#888",
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
  menuItemText: { fontSize: 17, marginLeft: 15, fontWeight: "500" },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
    opacity: 0.6,
    textTransform: "uppercase",
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  actionButton: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonTextBold: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  infoBox: { marginTop: "auto", paddingBottom: 40, opacity: 0.4 },
  infoTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 4 },
  infoText: { fontSize: 10 },
});
