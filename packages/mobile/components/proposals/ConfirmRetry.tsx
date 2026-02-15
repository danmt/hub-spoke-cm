import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text, View } from "../Themed";

interface Props {
  error: Error;
  onRetry: (choice: boolean) => void;
}

export function ConfirmRetry({ error, onRetry }: Props) {
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <FontAwesome name="exclamation-circle" size={64} color="#ff4444" />
      </View>
      <Text style={styles.title}>AI Generation Failed</Text>
      <View
        style={[
          styles.errorCard,
          { backgroundColor: colorScheme === "dark" ? "#2a1010" : "#fff5f5" },
        ]}
      >
        <Text style={styles.message}>{error.message}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.cancelButton]}
          onPress={() => onRetry(false)}
        >
          <Text style={styles.cancelText}>Stop Action</Text>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            { backgroundColor: themeColors.buttonPrimary },
          ]}
          onPress={() => onRetry(true)}
        >
          <Text style={styles.retryText}>Retry Request</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15 },
  errorCard: {
    padding: 20,
    borderRadius: 16,
    width: "100%",
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.2)",
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    color: "#cc0000",
  },
  actions: { width: "100%", gap: 12 },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  retryText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelButton: { borderWidth: 1, borderColor: "#ff4444" },
  cancelText: { color: "#ff4444", fontWeight: "bold", fontSize: 16 },
});
