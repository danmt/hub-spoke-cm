// packages/mobile/app/(tabs)/settings/config.tsx
import { ConfigSettings } from "@/components/settings/ConfigSettings";
import { View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { ConfigService } from "@hub-spoke/core";
import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

export default function ConfigScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const [model, setModel] = useState("");

  useEffect(() => {
    ConfigService.getConfig().then((c) =>
      setModel(c.model || "gemini-2.0-flash"),
    );
  }, []);

  return (
    <View style={styles.container}>
      <ConfigSettings
        model={model}
        setModel={setModel}
        themeColors={themeColors}
        colorScheme={colorScheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
});
