// packages/mobile/app/(tabs)/index.tsx
import { Text, View } from "@/components/Themed";
import { StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Content Hubs</Text>
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <Text style={styles.emptyText}>
        No hubs found in the documents directory.
      </Text>
      <Text style={styles.subText}>
        Tap "New Hub" to get started (Coming Soon).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: "100%",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  subText: {
    fontSize: 14,
    color: "#888",
    marginTop: 10,
    textAlign: "center",
    fontStyle: "italic",
  },
});
