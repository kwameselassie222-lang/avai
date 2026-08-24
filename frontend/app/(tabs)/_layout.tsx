import React from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
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
          title: "HOME",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="builder"
        options={{
          title: "ROBOTS",
          tabBarIcon: ({ color }) => <TabIcon name="robot" color={color} />,
        }}
      />
      <Tabs.Screen
        name="fleet"
        options={{
          title: "MAP",
          tabBarIcon: ({ color }) => <TabIcon name="map" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "COMMANDER",
          tabBarIcon: ({ color }) => <TabIcon name="account-hard-hat" color={color} />,
        }}
      />
    </Tabs>
  );
}
