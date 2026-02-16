import { ThemeColors } from "@/constants/Colors";
import { SecretService } from "@hub-spoke/core";
import React from "react";
import { Alert, Pressable, StyleSheet, TextInput } from "react-native";
import { Text, View } from "../Themed";

interface Props {
  apiKey: string;
  setApiKey: (k: string) => void;
  themeColors: ThemeColors;
  colorScheme: "light" | "dark";
}

export function SecretSettings({
  apiKey,
  setApiKey,
  themeColors,
  colorScheme,
}: Props) {
  const handleUpdate = async () => {
    try {
      await SecretService.updateSecret({ apiKey });
      Alert.alert("Success", "API Key updated.");
    } catch (e) {
      Alert.alert("Error", "Failed to update key.");
    }
  };

  return (
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
          { color: themeColors.text, borderColor: themeColors.tint },
        ]}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="Enter API Key"
        secureTextEntry
      />
      <Pressable
        style={[styles.button, { backgroundColor: themeColors.buttonPrimary }]}
        onPress={handleUpdate}
      >
        <Text style={styles.buttonText}>Update Key</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 16 },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    opacity: 0.6,
    textTransform: "uppercase",
  },
  input: { height: 50, borderBottomWidth: 2, fontSize: 16, marginBottom: 20 },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
});
