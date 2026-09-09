import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Clean slate. The previous UI, its logic, and the whole database schema were
// removed on 2026-09-09 to rebuild on different logic and a different style.
// Everything that was here is recoverable from git at 9fe1b55 if any of it is
// wanted back; the database is not.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ciatta</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 20,
  },
});
