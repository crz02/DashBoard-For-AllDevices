import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1f6feb',
        tabBarInactiveTintColor: '#8b949e',
        tabBarStyle: {
          backgroundColor: '#161b22',
          borderTopColor: '#30363d',
        },
        headerStyle: {
          backgroundColor: '#161b22',
          borderBottomColor: '#30363d',
        },
        headerTintColor: '#f0f6fc',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Statuser Agent',
          tabBarIcon: () => null, // Simplified for now
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Devices',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
