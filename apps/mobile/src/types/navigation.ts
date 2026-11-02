export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  EventRegistration: undefined;
  Main: undefined;
  Details: { serviceId: string; title: string };
};

export type MainTabParamList = {
  Home: undefined;
  News: undefined;
  Services: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
