import { useColorScheme } from "@/components/useColorScheme";
import { ArchitectResponse } from "@hub-spoke/core";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Text, View } from "../Themed";
import { ConfirmOrFeedback } from "./ConfirmOrFeedback";

interface Props {
  data: ArchitectResponse;
  onResolve: (response: any) => void;
}

export function ArchitectProposal({ data, onResolve }: Props) {
  const colorScheme = useColorScheme() ?? "dark";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Architecture Proposal</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.message}>{data.message}</Text>

        <View
          style={[
            styles.card,
            { backgroundColor: colorScheme === "dark" ? "#1a1a1a" : "#f2f2f2" },
          ]}
        >
          <Text style={styles.label}>Topic</Text>
          <Text style={styles.value}>{data.brief.topic}</Text>

          <Text style={styles.label}>Goal</Text>
          <Text style={styles.value}>{data.brief.goal}</Text>

          <Text style={styles.label}>Target Audience</Text>
          <Text style={styles.value}>{data.brief.audience}</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Persona</Text>
              <Text style={styles.value}>{data.brief.personaId}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Assembler</Text>
              <Text style={styles.value}>{data.brief.assemblerId}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Writers</Text>
              <Text style={styles.value}>
                {data.brief.allowedWriterIds.join(", ")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Shared interaction component with the feedback modal logic */}
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
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  scroll: { flex: 1 },
  message: { fontSize: 16, lineHeight: 24, marginBottom: 24, opacity: 0.8 },
  card: { padding: 20, borderRadius: 16, marginBottom: 20 },
  label: {
    fontSize: 10,
    fontWeight: "bold",
    opacity: 0.5,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  value: { fontSize: 17, fontWeight: "600", marginTop: 4 },
  row: { flexDirection: "row", marginTop: 5 },
});
