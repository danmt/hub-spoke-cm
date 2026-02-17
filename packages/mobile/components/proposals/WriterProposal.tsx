// packages/mobile/components/proposals/WriterProposal.tsx
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { WriterResponse } from "@hub-spoke/core";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Text, View } from "../Themed";
import { ConfirmOrFeedback } from "./ConfirmOrFeedback";

interface Props {
  data: WriterResponse;
  onResolve: (response: any) => void;
}

export function WriterProposal({ data, onResolve }: Props) {
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Writer Draft</Text>
      <Text style={styles.subtitle}>
        Review the technical content before styling.
      </Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.previewCard,
            { backgroundColor: themeColors.cardBackground },
          ]}
        >
          <Text style={[styles.headerPreview, { color: themeColors.tint }]}>
            {data.header}
          </Text>
          <View style={styles.separator} />
          <Text style={styles.contentPreview}>{data.content}</Text>
        </View>
      </ScrollView>

      <ConfirmOrFeedback
        confirmText="🚀 Approve"
        onConfirm={() => onResolve({ action: "proceed" })}
        onFeedback={(text) => onResolve({ action: "feedback", feedback: text })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 14, opacity: 0.6, marginBottom: 20 },
  scroll: { flex: 1 },
  previewCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.1)",
  },
  headerPreview: { fontSize: 20, fontWeight: "800", marginBottom: 16 },
  separator: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.1)",
    marginBottom: 16,
  },
  contentPreview: { fontSize: 15, lineHeight: 24, opacity: 0.9 },
});
