// packages/mobile/components/AgentThinkingOverlay.tsx
import { Vibe } from "@/utils/vibe";
import { FontAwesome } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet } from "react-native";
import { Text, View } from "./Themed";

interface Props {
  agentId: string;
  model: string;
  phase?: string; // 'planning', 'assembling', 'writing', 'styling'
  status: string;
  progressText?: string;
  color: string;
}

export function AgentThinkingOverlay({
  agentId,
  model,
  phase,
  status,
  progressText,
  color,
}: Props) {
  const [seconds, setSeconds] = useState(0);
  const pulse = new Animated.Value(1);

  useEffect(() => {
    // Start elapsed timer
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);

    // Tactile signal that a new agent has taken the floor
    Vibe.agentHeartbeat();

    // Visual pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    return () => clearInterval(timer);
  }, [agentId, phase]);

  const getAgentEmoji = () => {
    switch (phase) {
      case "planning":
        return "📐";
      case "assembling":
        return "🏗️";
      case "writing":
        return "🖋️";
      case "styling":
        return "✨";
      default:
        return "🧠";
    }
  };

  const getAgentIcon = () => {
    switch (phase) {
      case "writing":
        return "pencil-square";
      case "styling":
        return "magic";
      case "planning":
        return "map-o";
      case "assembling":
        return "th-list";
      default:
        return "flash";
    }
  };

  return (
    <View style={styles.overlay}>
      {progressText && (
        <View style={styles.topProgress}>
          <Text style={styles.progressLabel}>{progressText}</Text>
        </View>
      )}

      <Animated.View
        style={[styles.circle, { borderColor: color, opacity: pulse }]}
      >
        <FontAwesome name={getAgentIcon()} size={50} color={color} />
      </Animated.View>

      <View style={styles.agentMeta}>
        <Text style={styles.emoji}>{getAgentEmoji()}</Text>
        <Text style={styles.agentTitle}>@{agentId}</Text>
        <Text style={[styles.modelTag, { color }]}>{model.toUpperCase()}</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{status}</Text>
        <ActivityIndicator
          size="small"
          color={color}
          style={{ marginLeft: 15 }}
        />
      </View>

      <View style={styles.footer}>
        <FontAwesome name="clock-o" size={12} color="rgba(255,255,255,0.3)" />
        <Text style={styles.timerText}>{seconds}s active</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050505",
    padding: 30,
  },
  topProgress: {
    position: "absolute",
    top: 100,
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  progressLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  circle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  agentMeta: { alignItems: "center", marginBottom: 60 },
  emoji: { fontSize: 32, marginBottom: 10 },
  agentTitle: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  modelTag: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    marginTop: 6,
    opacity: 0.7,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
  },
  statusText: { fontSize: 16, color: "#eee", fontWeight: "600" },
  footer: {
    position: "absolute",
    bottom: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timerText: {
    color: "rgba(255,255,255,0.3)",
    fontWeight: "bold",
    fontSize: 14,
  },
});
