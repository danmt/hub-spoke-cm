import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { PersonaResponse } from "@hub-spoke/core";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Text, View } from "../Themed";
import { ConfirmOrFeedback } from "./ConfirmOrFeedback";

interface Props {
  data: PersonaResponse;
  onResolve: (response: any) => void;
}

export function PersonaProposal({ data, onResolve }: Props) {
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Persona Styling</Text>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.previewCard,
            { backgroundColor: colorScheme === "dark" ? "#1a1a1a" : "#fff" },
          ]}
        >
          <Text style={[styles.headerPreview, { color: themeColors.tint }]}>
            # {data.header}
          </Text>
          <View style={styles.separator} />
          <Text style={styles.contentPreview}>{data.content}</Text>
        </View>
      </ScrollView>

      <ConfirmOrFeedback
        confirmText="Finalize Scaffold"
        onConfirm={() => onResolve({ action: "proceed" })}
        onFeedback={(text) => onResolve({ action: "feedback", feedback: text })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 24 },
  scroll: { flex: 1 },
  previewCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.1)",
  },
  headerPreview: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
  separator: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.1)",
    marginBottom: 16,
  },
  contentPreview: { fontSize: 17, lineHeight: 28, opacity: 0.9 },
});
