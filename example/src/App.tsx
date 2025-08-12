import { Text, View, StyleSheet } from 'react-native';
import CodePush from '@logicwind/react-native-code-push';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    CodePush.sync({}, (status) => {
      console.log(status);
    });
  }, []);
  return (
    <View style={styles.container}>
      <Text>Codepush V2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
