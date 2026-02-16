// packages/mobile/app/(tabs)/settings/secrets.tsx
import { SecretSettings } from "@/components/settings/SecretSettings";
import { View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { SecretService } from "@hub-spoke/core";
import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

export default function SecretsScreen() {
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    SecretService.getSecret().then((s) => setApiKey(s.apiKey || ""));
  }, []);

  return (
    <View style={styles.container}>
      <SecretSettings
        apiKey={apiKey}
        setApiKey={setApiKey}
        themeColors={themeColors}
        colorScheme={colorScheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
});
