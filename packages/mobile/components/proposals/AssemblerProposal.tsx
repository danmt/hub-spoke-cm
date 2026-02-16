import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { AssembleResponse } from "@hub-spoke/core";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Text, View } from "../Themed";
import { ConfirmOrFeedback } from "./ConfirmOrFeedback";

interface Props {
  data: AssembleResponse;
  onResolve: (response: any) => void;
}

export function AssemblerProposal({ data, onResolve }: Props) {
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Content Blueprint</Text>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {data.blueprint.components.map((comp, index) => (
          <View
            key={comp.id}
            style={[
              styles.sectionCard,
              {
                backgroundColor: colorScheme === "dark" ? "#1a1a1a" : "#f8f8f8",
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.numberBadge,
                  { backgroundColor: themeColors.buttonPrimary },
                ]}
              >
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <Text style={styles.writerBadge}>
                {comp.writerId.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.headerText}>{comp.header}</Text>
            <Text style={styles.intentText}>{comp.intent}</Text>
          </View>
        ))}
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
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  scroll: { flex: 1 },
  sectionCard: {
    padding: 20,
    borderRadius: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#32a852",
  },
  sectionHeader: {
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  writerBadge: { fontSize: 10, fontWeight: "bold", opacity: 0.5 },
  headerText: { fontSize: 19, fontWeight: "bold", marginBottom: 8 },
  intentText: { fontSize: 15, lineHeight: 22, opacity: 0.8 },
});
