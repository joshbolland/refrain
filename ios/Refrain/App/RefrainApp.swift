import SwiftUI

@main
struct RefrainApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var appState = AppState()
    @State private var keyboardObserver = KeyboardObserver()

    init() {
        Theme.configureAppearance()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(\.keyboardObserver, keyboardObserver)
                .preferredColorScheme(.light)
                .onChange(of: scenePhase) { _, newPhase in
                    guard newPhase == .active else {
                        return
                    }

                    Task {
                        await appState.importSharedItemsIfNeeded()
                    }
                }
        }
    }
}
