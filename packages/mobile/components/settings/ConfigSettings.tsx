import { ThemeColors } from "@/constants/Colors";
import { ConfigService } from "@hub-spoke/core";
import React from "react";
import { Alert, Pressable, StyleSheet } from "react-native";
import { Text, View } from "../Themed";
import { InputField } from "../form/InputField";

interface Props {
  model: string;
  setModel: (m: string) => void;
  themeColors: ThemeColors;
  colorScheme: "light" | "dark";
}

export function ConfigSettings({
  model,
  setModel,
  themeColors,
  colorScheme,
}: Props) {
  const handleUpdate = async () => {
    try {
      await ConfigService.updateConfig({ model });
      Alert.alert("Success", "Configuration updated.");
    } catch (e) {
      Alert.alert("Error", "Failed to update configuration.");
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colorScheme === "dark" ? "#1a1a1a" : "#f2f2f2" },
      ]}
    >
      <InputField
        label="Default AI Model"
        value={model}
        onChangeText={setModel}
        placeholder="e.g. gemini-2.0-flash"
        placeholderTextColor="#888"
      />
      <Pressable
        style={[styles.button, { backgroundColor: themeColors.buttonPrimary }]}
        onPress={handleUpdate}
      >
        <Text style={styles.buttonText}>Save Changes</Text>
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
