import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import GreetingCard from '../../components/home/GreetingCard';
import FeatureCards from '../../components/home/FeatureCards';
import MoodSection from '../../components/home/MoodSection';
import WorkoutSection from '../../components/home/WorkoutSection';
import ChallengesSection from '../../components/home/ChallengesSection';
import AccountabilitySection from '../../components/home/AccountabilitySection';
import InviteFriendsCard from '../../components/home/InviteFriendsCard';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setRefreshToken((current) => current + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <VictoryHeader />
        <GreetingCard />
        <FeatureCards />
        <MoodSection />
        <WorkoutSection />
        <ChallengesSection refreshToken={refreshToken} />
        {/* <AccountabilitySection /> */}
        <InviteFriendsCard />
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
});
