import React from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { colors, fonts, fontSize } from "@/src/theme";

function TabIcon({ name, color }: { name: any; color: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <MaterialCommunityIcons name={name} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderStrong,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.displayBold,
          fontSize: fontSize.xs,
          letterSpacing: 1.4,
        },
      }}
    >
      <Tabs.Screen
        name="command"
        options={{
          title: "COMMAND",
          tabBarIcon: ({ color }) => <TabIcon name="radar" color={color} />,
          tabBarTestID: "tab-command",
        }}
      />
      <Tabs.Screen
        name="builder"
        options={{
          title: "BUILDER",
          tabBarIcon: ({ color }) => <TabIcon name="robot-industrial" color={color} />,
          tabBarTestID: "tab-builder",
        }}
      />
      <Tabs.Screen
        name="fleet"
        options={{
          title: "FLEET",
          tabBarIcon: ({ color }) => <TabIcon name="robot-happy" color={color} />,
          tabBarTestID: "tab-fleet",
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "RANKS",
          tabBarIcon: ({ color }) => <TabIcon name="trophy" color={color} />,
          tabBarTestID: "tab-leaderboard",
        }}
      />
    </Tabs>
  );
}
